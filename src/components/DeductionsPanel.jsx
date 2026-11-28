// ── Deductions ──────────────────────────────────────────────────────────────
// Money a staff member owes back (training, badge renewal, DBS…) that is taken
// off a future payment. A charge can be spread over several months: each month
// is its own row (instalment), linked by groupId.
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../context/AppContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal, { FormField, FormGrid, ModalFooter } from "./Modal";
import EmptyState from "./EmptyState";
import { uid, fmt, fmtD, MONTHS, MONTHS_SHORT, YEARS } from "../lib/utils";

export const CHARGE_CATEGORIES = [
  { value: "training", label: "Training" },
  { value: "badge", label: "Badge renewal" },
  { value: "dbs", label: "DBS check" },
  { value: "uniform", label: "Uniform / equipment" },
  { value: "other", label: "Other" },
];
export const categoryLabel = (v) =>
  CHARGE_CATEGORIES.find((c) => c.value === v)?.label || "Other";

const STATUS_CHIP = {
  outstanding: { cls: "chip-amber", label: "To deduct" },
  deducted: { cls: "chip-green", label: "Deducted" },
  waived: { cls: "chip-gray", label: "Waived" },
};

const today = () => new Date().toISOString().split("T")[0];

// Default: comes off the pay for the work month the charge falls in — that is
// the next payment made after the charge date
const defaultDeductFrom = (dateStr) => {
  const d = new Date(dateStr || today());
  return { month: d.getMonth(), year: d.getFullYear() };
};

// Split an amount into n instalments; any rounding penny goes on the last one
const splitAmount = (total, n) => {
  const pence = Math.round(Number(total) * 100);
  const each = Math.floor(pence / n);
  return Array.from({ length: n }, (_, i) =>
    i === n - 1 ? (pence - each * (n - 1)) / 100 : each / 100,
  );
};

const addMonths = (month, year, add) => {
  const k = Number(year) * 12 + Number(month) + add;
  return { month: k % 12, year: Math.floor(k / 12) };
};

const EMPTY = () => {
  const from = defaultDeductFrom(today());
  return {
    staffId: "",
    isExternal: false,
    externalName: "",
    category: "training",
    description: "",
    chargeDate: today(),
    amount: "",
    deductMonth: from.month,
    deductYear: from.year,
    instalments: 1,
    notes: "",
  };
};

export default function DeductionsPanel() {
  const { staffCharges = [], setStaffCharges, staff } = useApp();
  const showConfirm = useConfirm();
  const [statusF, setStatusF] = useState("outstanding");
  const [staffF, setStaffF] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const nameOf = (c) =>
    c.isExternal
      ? c.staffName
      : staff.find((s) => s.id === c.staffId)?.name || c.staffName || "Unknown";

  const open = () => {
    setForm(EMPTY());
    setEditing(null);
    setShowModal(true);
  };
  const edit = (c) => {
    setForm({
      staffId: c.staffId || "",
      isExternal: c.isExternal,
      externalName: c.isExternal ? c.staffName : "",
      category: c.category,
      description: c.description,
      chargeDate: c.chargeDate || today(),
      amount: c.amount,
      deductMonth: c.deductMonth,
      deductYear: c.deductYear,
      instalments: 1,
      notes: c.notes,
    });
    setEditing(c);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  // Preview of the instalments that will be created
  const plan = (() => {
    const n = Math.max(1, Number(form.instalments) || 1);
    if (!(Number(form.amount) > 0)) return [];
    return splitAmount(form.amount, n).map((amount, i) => ({
      amount,
      ...addMonths(form.deductMonth, form.deductYear, i),
    }));
  })();

  const save = async () => {
    const name = form.isExternal
      ? form.externalName.trim()
      : staff.find((s) => s.id === form.staffId)?.name;
    if (!name) return toast.error("Choose who the deduction is for.");
    if (!(Number(form.amount) > 0)) return toast.error("Enter an amount.");

    const base = {
      staffId: form.isExternal ? null : form.staffId,
      staffName: name,
      isExternal: form.isExternal,
      category: form.category,
      description: form.description.trim(),
      chargeDate: form.chargeDate,
      notes: form.notes,
    };

    let next;
    if (editing) {
      next = staffCharges.map((c) =>
        c.id === editing.id
          ? {
              ...c,
              ...base,
              amount: Number(form.amount),
              deductMonth: Number(form.deductMonth),
              deductYear: Number(form.deductYear),
            }
          : c,
      );
    } else {
      const groupId = uid();
      const now = Date.now();
      const rows = plan.map((p, i) => ({
        ...base,
        id: uid(),
        amount: p.amount,
        deductMonth: p.month,
        deductYear: p.year,
        groupId,
        instalmentNo: i + 1,
        instalments: plan.length,
        status: "outstanding",
        paymentId: null,
        createdAt: now + i,
      }));
      next = [...staffCharges, ...rows];
    }

    const ok = await setStaffCharges(next, {
      action: editing ? "update" : "create",
      id: editing?.id || next[next.length - 1].id,
      label: `Deduction for ${name} — ${fmt(Number(form.amount))} (${categoryLabel(form.category)})`,
    });
    if (ok) {
      toast.success(editing ? "Deduction updated." : "Deduction added.");
      close();
    }
  };

  const setStatus = async (c, status) => {
    const label = status === "waived" ? "Waive" : "Restore";
    const yes = await showConfirm({
      title: `${label} this deduction?`,
      message:
        status === "waived"
          ? `${fmt(c.amount)} for ${nameOf(c)} will no longer be taken off their pay.`
          : `${fmt(c.amount)} for ${nameOf(c)} will be taken off their pay again.`,
      type: status === "waived" ? "danger" : "info",
      confirmLabel: label,
    });
    if (!yes) return;
    const ok = await setStaffCharges(
      staffCharges.map((x) =>
        x.id === c.id ? { ...x, status, paymentId: null } : x,
      ),
      {
        action: "update",
        id: c.id,
        label: `Deduction for ${nameOf(c)} ${status === "waived" ? "waived" : "restored"}`,
      },
    );
    if (ok)
      toast.success(
        status === "waived" ? "Deduction waived." : "Deduction restored.",
      );
  };

  const del = async (c) => {
    const group = c.groupId
      ? staffCharges.filter((x) => x.groupId === c.groupId)
      : [c];
    const all = group.length > 1;
    const yes = await showConfirm({
      title: all
        ? `Delete all ${group.length} instalments?`
        : "Delete this deduction?",
      message: all
        ? `This deletes every instalment of this ${fmt(group.reduce((s, x) => s + x.amount, 0))} charge for ${nameOf(c)}. This cannot be undone.`
        : `${fmt(c.amount)} for ${nameOf(c)}. This cannot be undone.`,
      type: "danger",
      confirmLabel: "Delete",
    });
    if (!yes) return;
    const ids = new Set(group.map((x) => x.id));
    const ok = await setStaffCharges(
      staffCharges.filter((x) => !ids.has(x.id)),
      {
        action: "delete",
        id: c.id,
        label: `Deduction for ${nameOf(c)} deleted`,
      },
    );
    if (ok) toast.success("Deleted.");
  };

  const list = staffCharges
    .filter((c) => statusF === "all" || c.status === statusF)
    .filter((c) =>
      staffF === "all"
        ? true
        : staffF === "external"
          ? c.isExternal
          : c.staffId === staffF,
    )
    .sort(
      (a, b) =>
        a.deductYear * 12 +
          a.deductMonth -
          (b.deductYear * 12 + b.deductMonth) ||
        nameOf(a).localeCompare(nameOf(b)),
    );
  const outstandingTotal = staffCharges
    .filter((c) => c.status === "outstanding")
    .reduce((s, c) => s + c.amount, 0);

  // Edit / Waive / Restore / Delete — shared by the table and phone cards
  const renderActions = (c) => (
    <>
      {c.status === "outstanding" && (
        <>
          <button className="btn-ghost" onClick={() => edit(c)}>
            Edit
          </button>
          <button className="btn-ghost" onClick={() => setStatus(c, "waived")}>
            Waive
          </button>
        </>
      )}
      {c.status === "waived" && (
        <button
          className="btn-ghost"
          onClick={() => setStatus(c, "outstanding")}
        >
          Restore
        </button>
      )}
      {c.status !== "deducted" && (
        <button
          className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          onClick={() => del(c)}
        >
          Del
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="input w-full sm:w-40"
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
        >
          <option value="outstanding">To deduct</option>
          <option value="deducted">Deducted</option>
          <option value="waived">Waived</option>
          <option value="all">All</option>
        </select>
        <select
          className="input w-full sm:w-44"
          value={staffF}
          onChange={(e) => setStaffF(e.target.value)}
        >
          <option value="all">All staff</option>
          <option value="external">External only</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Still to deduct:{" "}
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {fmt(outstandingTotal)}
          </span>
        </span>
        <button
          className="btn-primary w-full sm:w-auto sm:ml-auto"
          onClick={open}
        >
          + Add deduction
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No deductions here"
          description="Record training, badge renewals and other costs you paid for a driver or PA, so they come off their pay."
        />
      ) : (
        <>
          {/* Phones: one card per deduction */}
          <div className="md:hidden space-y-2">
            {list.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {nameOf(c)}
                      {c.isExternal && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                          External
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {categoryLabel(c.category)}
                      {c.description ? ` — ${c.description}` : ""}
                    </p>
                  </div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                    {fmt(c.amount)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className={STATUS_CHIP[c.status]?.cls || "chip-gray"}>
                    {STATUS_CHIP[c.status]?.label || c.status}
                  </span>
                  <span>
                    Off pay for {MONTHS_SHORT[c.deductMonth]} {c.deductYear}
                    {c.instalments > 1
                      ? ` (${c.instalmentNo} of ${c.instalments})`
                      : ""}
                  </span>
                  {c.chargeDate && <span>Charged {fmtD(c.chargeDate)}</span>}
                </div>
                {c.status !== "deducted" && (
                  <div className="flex flex-wrap gap-1 mt-2 -ml-2">
                    {renderActions(c)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tablets and desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="thead-row">
                  <th className="th">Staff member</th>
                  <th className="th">What for</th>
                  <th className="th">Charge date</th>
                  <th className="th">Comes off pay for</th>
                  <th className="th-r">Amount</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {list.map((c) => (
                  <tr key={c.id} className="tr">
                    <td className="td">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {nameOf(c)}
                      </span>
                      {c.isExternal && (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                          External
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {categoryLabel(c.category)}
                      </p>
                      {c.description && (
                        <p className="muted">{c.description}</p>
                      )}
                    </td>
                    <td className="td text-gray-600 dark:text-gray-400">
                      {c.chargeDate ? fmtD(c.chargeDate) : "—"}
                    </td>
                    <td className="td text-gray-600 dark:text-gray-400">
                      {MONTHS_SHORT[c.deductMonth]} {c.deductYear}
                      {c.instalments > 1 && (
                        <span className="muted ml-1">
                          ({c.instalmentNo} of {c.instalments})
                        </span>
                      )}
                    </td>
                    <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(c.amount)}
                    </td>
                    <td className="td">
                      <span
                        className={STATUS_CHIP[c.status]?.cls || "chip-gray"}
                      >
                        {STATUS_CHIP[c.status]?.label || c.status}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex gap-1 justify-end">
                        {renderActions(c)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <Modal
          title={editing ? "Edit deduction" : "Add deduction"}
          onClose={close}
        >
          <div className="space-y-4">
            <FormField label="Staff member *">
              {form.isExternal ? (
                <input
                  className="input"
                  value={form.externalName}
                  onChange={f("externalName")}
                  placeholder="Name exactly as on their payments"
                />
              ) : (
                <select
                  className="input"
                  value={form.staffId}
                  onChange={f("staffId")}
                >
                  <option value="">Select staff…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            {!editing && (
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer -mt-2">
                <input
                  type="checkbox"
                  checked={form.isExternal}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      isExternal: e.target.checked,
                      staffId: "",
                      externalName: "",
                    }))
                  }
                  className="w-3.5 h-3.5 rounded"
                />
                External temp (not in staff list)
              </label>
            )}
            <FormGrid cols={2}>
              <FormField label="What for">
                <select
                  className="input"
                  value={form.category}
                  onChange={f("category")}
                >
                  {CHARGE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Charge date" hint="When you paid it for them">
                <input
                  className="input"
                  type="date"
                  value={form.chargeDate}
                  onChange={(e) => {
                    const from = defaultDeductFrom(e.target.value);
                    setForm((p) => ({
                      ...p,
                      chargeDate: e.target.value,
                      ...(editing
                        ? {}
                        : { deductMonth: from.month, deductYear: from.year }),
                    }));
                  }}
                />
              </FormField>
            </FormGrid>
            <FormField label="Description">
              <input
                className="input"
                value={form.description}
                onChange={f("description")}
                placeholder="e.g. Safeguarding course, Crawley badge renewal"
              />
            </FormField>
            <FormGrid cols={editing ? 1 : 2}>
              <FormField
                label={editing ? "Amount (£) *" : "Total amount (£) *"}
              >
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={f("amount")}
                  placeholder="0.00"
                />
              </FormField>
              {!editing && (
                <FormField label="Spread over">
                  <select
                    className="input"
                    value={form.instalments}
                    onChange={f("instalments")}
                  >
                    <option value={1}>1 month (one payment)</option>
                    <option value={2}>2 months</option>
                    <option value={3}>3 months</option>
                    <option value={4}>4 months</option>
                    <option value={6}>6 months</option>
                  </select>
                </FormField>
              )}
            </FormGrid>
            <FormGrid cols={2}>
              <FormField
                label={editing ? "Comes off pay for" : "Starting from pay for"}
                hint="The work month whose pay it is taken from"
              >
                <select
                  className="input"
                  value={form.deductMonth}
                  onChange={f("deductMonth")}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Year">
                <select
                  className="input"
                  value={form.deductYear}
                  onChange={f("deductYear")}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            {!editing && plan.length > 1 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
                  {plan.length} instalments
                </p>
                <ul className="text-amber-700 dark:text-amber-400 space-y-0.5">
                  {plan.map((p, i) => (
                    <li key={i}>
                      {MONTHS_SHORT[p.month]} {p.year}: {fmt(p.amount)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FormField label="Notes (optional)">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={f("notes")}
              />
            </FormField>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              {editing ? "Save changes" : "Add deduction"}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
