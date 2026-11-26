import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { toast } from "sonner";
import { useConfirm } from "../context/ConfirmContext";
import PayRun from "../components/PayRun";
import DeductionsPanel, { categoryLabel } from "../components/DeductionsPanel";
import { getPayables } from "../lib/monthStatus";

import {
  uid,
  fmt,
  fmtD,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
  cleanNum,
  getAllocAmountForStaff,
  getAllocDetailForStaff,
} from "../lib/utils";

const PAY_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "advance", label: "Advance" },
  { value: "partial", label: "Partial" },
];
const EMPTY = {
  staffId: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  type: "regular",
  month: currentMonth(),
  year: currentYear(),
  reference: "",
  notes: "",
  allocationIds: [],
  isExternal: false,
  externalName: "",
  chargeIds: [], // deductions taken off this payment
};

const TABS = [
  { key: "payments", label: "Payments" },
  { key: "payrun", label: "Pay run" },
  { key: "deductions", label: "Deductions" },
];
const periodKey = (m, y) => Number(y) * 12 + Number(m);

export default function Payments() {
  const {
    payments,
    setPayments,
    staff,
    allocations,
    submissions,
    staffCharges = [],
    setStaffCharges,
  } = useApp();
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem("pay_tab") || "payments";
    } catch {
      return "payments";
    }
  });
  const switchTab = (key) => {
    setTab(key);
    try {
      localStorage.setItem("pay_tab", key);
    } catch {
      /* ignore */
    }
  };
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [staffF, setStaffF] = useState("all");
  const [monthF, setMonthF] = useState("all");
  const [yearF, setYearF] = useState(
    () => localStorage.getItem("pay_yearF") || String(currentYear()),
  );

  const showConfirm = useConfirm();

  // ── Deductions for the person on the payment form ─────────────────────────
  const chargesFor = (staffId, externalName, isExternal) =>
    staffCharges.filter((c) =>
      isExternal
        ? c.isExternal &&
          (c.staffName || "").trim().toLowerCase() ===
            (externalName || "").trim().toLowerCase()
        : !c.isExternal && staffId && c.staffId === staffId,
    );
  // Outstanding deductions due by the given work month — ticked by default
  const dueChargeIds = (staffId, externalName, isExternal, month, year) =>
    chargesFor(staffId, externalName, isExternal)
      .filter(
        (c) =>
          c.status === "outstanding" &&
          periodKey(c.deductMonth, c.deductYear) <= periodKey(month, year),
      )
      .map((c) => c.id);

  // Open the payment form from the Pay run, already filled in
  const payFromRun = (row, month, year) => {
    setForm({
      ...EMPTY,
      date: new Date().toISOString().split("T")[0],
      staffId: row.isExternal ? "" : row.staffId,
      isExternal: row.isExternal,
      externalName: row.isExternal ? row.name : "",
      amount: row.netToPay.toFixed(2),
      month,
      year,
      reference: `${MONTHS[month]} ${year} pay`,
      chargeIds: row.outstandingCharges.map((c) => c.id),
    });
    setEditing(null);
    setShowModal(true);
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const open = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowModal(true);
  };
  const edit = (p) => {
    setForm({
      staffId: p.staffId || "",
      amount: p.amount,
      date: p.date,
      type: p.type,
      month: p.month,
      year: p.year,
      reference: p.reference || "",
      notes: p.notes || "",
      allocationIds: p.allocationIds || [],
      isExternal: p.isExternal || false,
      externalName: p.externalName || "",
      chargeIds: staffCharges
        .filter((c) => c.paymentId === p.id)
        .map((c) => c.id),
    });
    setEditing(p);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = async () => {
    if ((!form.staffId && !form.externalName) || !form.amount) return;
    const { chargeIds = [], ...fields } = form;
    const record = {
      id: editing?.id || uid(),
      ...fields,
      amount: parseFloat(form.amount),
      month: parseInt(form.month),
      year: parseInt(form.year),
      allocationIds: form.allocationIds || [],
      periodMonth: parseInt(form.month),
      periodYear: parseInt(form.year),
      createdAt: editing?.createdAt || Date.now(),
    };
    const name = form.isExternal
      ? form.externalName
      : staff.find((s) => s.id === form.staffId)?.name;
    const ok = await setPayments(
      editing
        ? payments.map((x) => (x.id === editing.id ? record : x))
        : [...payments, record],
      {
        action: editing ? "update" : "create",
        id: record.id,
        label: `Payment to ${name} — ${fmt(record.amount)}`,
      },
    );
    if (!ok) return; // form stays open; the error message is already shown

    // Mark ticked deductions as taken off this payment; any that were linked
    // to it before but are now unticked go back to "to deduct"
    const changed = staffCharges.some(
      (c) =>
        (chargeIds.includes(c.id) && c.paymentId !== record.id) ||
        (!chargeIds.includes(c.id) && c.paymentId === record.id),
    );
    if (changed) {
      const okCharges = await setStaffCharges(
        staffCharges.map((c) => {
          if (chargeIds.includes(c.id))
            return { ...c, status: "deducted", paymentId: record.id };
          if (c.paymentId === record.id)
            return { ...c, status: "outstanding", paymentId: null };
          return c;
        }),
      );
      if (!okCharges) {
        toast.error(
          "The payment was saved, but the deductions weren't marked. Open the Deductions tab and check them.",
          { duration: 15000 },
        );
        close();
        return;
      }
    }
    toast.success(
      editing
        ? "Payment updated."
        : chargeIds.length
          ? `Payment logged. ${chargeIds.length} deduction${chargeIds.length > 1 ? "s" : ""} marked as deducted.`
          : "Payment logged.",
    );
    close();
  };

  const del = async (id) => {
    const p = payments.find((x) => x.id === id);
    const name = p?.isExternal
      ? p.externalName
      : staff.find((s) => s.id === p?.staffId)?.name || "Unknown";
    const confirmed = await showConfirm({
      title: "Delete this payment?",
      message: `${fmt(p?.amount)} to ${name} — ${MONTHS_SHORT[p?.month]} ${p?.year}. This cannot be undone.`,
      type: "danger",
      confirmLabel: "Delete",
    });
    if (confirmed) {
      const ok = await setPayments(
        payments.filter((x) => x.id !== id),
        {
          action: "delete",
          id,
          label: `Payment to ${name} — ${fmt(p?.amount)}`,
        },
      );
      if (!ok) return;
      // Deductions taken off this payment go back to "to deduct"
      if (staffCharges.some((c) => c.paymentId === id)) {
        await setStaffCharges(
          staffCharges.map((c) =>
            c.paymentId === id
              ? { ...c, status: "outstanding", paymentId: null }
              : c,
          ),
        );
      }
      toast.success("Payment deleted.");
    }
  };
  const getName = (id) => staff.find((s) => s.id === id)?.name || "Unknown";

  const filtered = payments
    .filter((p) => {
      if (staffF === "external") return p.isExternal === true;
      if (staffF !== "all" && p.staffId !== staffF) return false;
      if (monthF !== "all" && p.month !== parseInt(monthF)) return false;
      if (yearF !== "all" && p.year !== parseInt(yearF)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = filtered.reduce((s, p) => s + p.amount, 0);

  // const staffSummary = staff
  //   .map((s) => ({
  //     ...s,
  //     paid: filtered
  //       .filter((p) => p.staffId === s.id)
  //       .reduce((sum, p) => sum + p.amount, 0),
  //   }))
  //   .filter((s) => s.paid > 0)
  //   .sort((a, b) => b.paid - a.paid);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Staff Payments"
        subtitle="Pay run, payments and deductions"
        actions={
          <button className="btn-primary" onClick={open}>
            + Log payment
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 px-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        {TABS.map((t) => {
          const count =
            t.key === "deductions"
              ? staffCharges.filter((c) => c.status === "outstanding").length
              : 0;
          return (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-700 dark:text-blue-400 font-medium"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "payrun" && (
        <div className="page-body">
          <PayRun onPay={payFromRun} />
        </div>
      )}
      {tab === "deductions" && (
        <div className="page-body">
          <DeductionsPanel />
        </div>
      )}

      {tab === "payments" && (
        <>
          <div className="toolbar">
            <select
              className="input w-44"
              value={staffF}
              onChange={(e) => setStaffF(e.target.value)}
            >
              <option value="all">All staff</option>
              <option value="external">External / one-off only</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="input w-36"
              value={monthF}
              onChange={(e) => setMonthF(e.target.value)}
            >
              <option value="all">All months</option>
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="input w-28"
              value={yearF}
              onChange={(e) => {
                setYearF(e.target.value);
                localStorage.setItem("pay_yearF", e.target.value);
              }}
            >
              <option value="all">All years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {filtered.length > 0 && (
              <div className="ml-auto flex items-center gap-4 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {filtered.length} payment{filtered.length !== 1 ? "s" : ""}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {fmt(total)}
                </span>
              </div>
            )}
          </div>

          <div className="page-body">
            {/* Staff summary cards */}
            {/* {staffSummary.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {staffSummary.map((s) => (
              <div key={s.id} className="metric">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 avatar text-xs flex-shrink-0">{s.name[0]}</div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{s.name}</p>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{fmt(s.paid)}</p>
                <p className="muted capitalize">{s.type?.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        )} */}

            {filtered.length === 0 ? (
              <EmptyState
                icon="💷"
                title="No payments found"
                description="Log your first staff payment using the button above."
                action={
                  <button className="btn-primary" onClick={open}>
                    Log payment
                  </button>
                }
              />
            ) : (
              <div className="card overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    <tr className="thead-row">
                      <th className="th">Staff member</th>
                      <th className="th">Date paid</th>
                      <th className="th">For period</th>
                      <th className="th">Type</th>
                      <th className="th">Reference</th>
                      <th className="th-r">Amount</th>
                      <th className="th"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filtered.map((p) => (
                      <tr key={p.id} className="tr">
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 avatar text-xs">
                              {p.isExternal
                                ? p.externalName?.[0] || "E"
                                : getName(p.staffId)[0]}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {p.isExternal
                                  ? p.externalName
                                  : getName(p.staffId)}
                              </span>
                              {p.isExternal && (
                                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                                  External
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="td text-gray-600 dark:text-gray-400">
                          {fmtD(p.date)}
                        </td>
                        <td className="td text-gray-600 dark:text-gray-400">
                          {MONTHS_SHORT[p.month]} {p.year}
                        </td>
                        <td className="td">
                          <Badge
                            type={p.type === "partial" ? "partial_pay" : p.type}
                            label={p.type}
                          />
                        </td>
                        <td className="td">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {p.reference || "—"}
                          </p>
                          {p.allocationIds?.length > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                              Settles {p.allocationIds.length} route
                              {p.allocationIds.length > 1 ? "s" : ""}
                            </p>
                          )}
                          {(() => {
                            const ded = staffCharges.filter(
                              (c) => c.paymentId === p.id,
                            );
                            if (!ded.length) return null;
                            return (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                After{" "}
                                {fmt(ded.reduce((s, c) => s + c.amount, 0))}{" "}
                                deduction
                                {ded.length > 1 ? "s" : ""}
                              </p>
                            );
                          })()}
                          {(() => {
                            const sub = submissions?.find(
                              (s) => s.paymentId === p.id,
                            );
                            if (!sub) return null;
                            return (
                              <a
                                href="/invoice-submissions"
                                className="text-xs text-purple-600 dark:text-purple-400 hover:underline mt-0.5 block"
                              >
                                📄 View original submission
                              </a>
                            );
                          })()}
                        </td>
                        <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                          {fmt(p.amount)}
                        </td>
                        <td className="td">
                          <div className="flex gap-1">
                            <button
                              className="btn-ghost"
                              onClick={() => edit(p)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => del(p.id)}
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <Modal
          title={editing ? "Edit payment" : "Log staff payment"}
          onClose={close}
        >
          <div className="space-y-4">
            <FormField label="Staff member *">
              {form.isExternal ? (
                <input
                  className="input"
                  value={form.externalName}
                  onChange={(e) => {
                    const externalName = e.target.value;
                    setForm((p) => ({
                      ...p,
                      externalName,
                      chargeIds: editing
                        ? p.chargeIds
                        : dueChargeIds(
                            null,
                            externalName,
                            true,
                            p.month,
                            p.year,
                          ),
                    }));
                  }}
                  placeholder="e.g. Ahmed Khan — ABC Taxis"
                />
              ) : (
                <select
                  className="input"
                  value={form.staffId}
                  onChange={(e) => {
                    const staffId = e.target.value;
                    setForm((p) => ({
                      ...p,
                      staffId,
                      chargeIds: editing
                        ? p.chargeIds
                        : dueChargeIds(staffId, "", false, p.month, p.year),
                    }));
                  }}
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
              External / one-off payment (driver not in staff list)
            </label>
            <FormGrid cols={2}>
              <FormField label="Amount (£) *">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={f("amount")}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label="Date paid">
                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={f("date")}
                />
              </FormField>
            </FormGrid>
            <FormField label="Payment type">
              <select className="input" value={form.type} onChange={f("type")}>
                {PAY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormGrid cols={2}>
              <FormField label="For month">
                <select
                  className="input"
                  value={form.month}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => {
                      const next = { ...p, month: value };
                      if (!editing)
                        next.chargeIds = dueChargeIds(
                          p.staffId,
                          p.externalName,
                          p.isExternal,
                          next.month,
                          next.year,
                        );
                      return next;
                    });
                  }}
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
                  value={form.year}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((p) => {
                      const next = { ...p, year: value };
                      if (!editing)
                        next.chargeIds = dueChargeIds(
                          p.staffId,
                          p.externalName,
                          p.isExternal,
                          next.month,
                          next.year,
                        );
                      return next;
                    });
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
            <FormField label="Reference">
              <input
                className="input"
                value={form.reference}
                onChange={f("reference")}
                placeholder="e.g. April 2026 Route 50540"
              />
            </FormField>

            {/* Deductions reminder */}
            {(() => {
              const mine = chargesFor(
                form.staffId,
                form.externalName,
                form.isExternal,
              );
              const target = periodKey(form.month, form.year);
              const due = mine.filter(
                (c) =>
                  (c.status === "outstanding" &&
                    periodKey(c.deductMonth, c.deductYear) <= target) ||
                  (editing && c.paymentId === editing.id),
              );
              const later = mine.filter(
                (c) =>
                  c.status === "outstanding" &&
                  periodKey(c.deductMonth, c.deductYear) > target,
              );
              if (due.length === 0 && later.length === 0) return null;
              const ticked = due.filter((c) =>
                (form.chargeIds || []).includes(c.id),
              );
              const tickedTotal = ticked.reduce((s, c) => s + c.amount, 0);
              // Suggested amount for this work month, after deductions
              const row = getPayables({
                month: Number(form.month),
                year: Number(form.year),
                allocations,
                staff,
                payments: editing
                  ? payments.filter((x) => x.id !== editing.id)
                  : payments,
                staffCharges,
              }).rows.find((r) =>
                form.isExternal
                  ? r.isExternal &&
                    r.name.trim().toLowerCase() ===
                      form.externalName.trim().toLowerCase()
                  : r.staffId === form.staffId,
              );
              return (
                <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                  {due.length > 0 && (
                    <>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        ⚠ Deductions to take off this payment
                      </p>
                      {due.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded"
                            checked={(form.chargeIds || []).includes(c.id)}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                chargeIds: e.target.checked
                                  ? [...(p.chargeIds || []), c.id]
                                  : (p.chargeIds || []).filter(
                                      (x) => x !== c.id,
                                    ),
                              }))
                            }
                          />
                          <span className="flex-1">
                            {categoryLabel(c.category)}
                            {c.description ? ` — ${c.description}` : ""}
                            <span className="text-amber-600 dark:text-amber-400">
                              {" "}
                              ({MONTHS_SHORT[c.deductMonth]} {c.deductYear}
                              {c.instalments > 1
                                ? `, ${c.instalmentNo} of ${c.instalments}`
                                : ""}
                              )
                            </span>
                          </span>
                          <span className="font-semibold">{fmt(c.amount)}</span>
                        </label>
                      ))}
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Ticked: {fmt(tickedTotal)} — these are marked as
                        deducted when you save.
                      </p>
                    </>
                  )}
                  {row && (
                    <div className="flex items-center justify-between gap-3 text-sm pt-1 border-t border-amber-200 dark:border-amber-800">
                      <span className="text-amber-800 dark:text-amber-300">
                        Suggested payment for {MONTHS_SHORT[form.month]}{" "}
                        {form.year}, after deductions:{" "}
                        <span className="font-semibold">
                          {fmt(Math.max(0, row.netToPay))}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn-secondary text-xs px-2 py-1"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            amount: Math.max(0, row.netToPay).toFixed(2),
                          }))
                        }
                      >
                        Use
                      </button>
                    </div>
                  )}
                  {later.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Later instalments:{" "}
                      {later
                        .map(
                          (c) =>
                            `${MONTHS_SHORT[c.deductMonth]} ${c.deductYear} ${fmt(c.amount)}`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Link to allocations */}
            {(() => {
              const staffAllocs = allocations.filter(
                (a) =>
                  (a.regularStaffId === form.staffId ||
                    a.tempStaffId === form.staffId ||
                    (a.coverEntries || []).some(
                      (c) => c.staffId === form.staffId,
                    ) ||
                    a.paStaffId === form.staffId ||
                    (a.additiveEntries || []).some(
                      (e) => e.staffId === form.staffId,
                    )) &&
                  a.month === Number(form.month) &&
                  a.year === Number(form.year),
              );
              if (staffAllocs.length === 0) return null;
              const totalSelected = staffAllocs
                .filter((a) => (form.allocationIds || []).includes(a.id))
                .reduce(
                  (s, a) => s + getAllocAmountForStaff(a, form.staffId),
                  0,
                );
              return (
                <FormField
                  label="Settles allocations"
                  hint="Tick which routes this payment covers"
                >
                  <div className="space-y-2 mt-1">
                    {staffAllocs.map((a) => {
                      const amount = getAllocAmountForStaff(a, form.staffId);
                      const checked = (form.allocationIds || []).includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const ids = form.allocationIds || [];
                              setForm((p) => ({
                                ...p,
                                allocationIds: e.target.checked
                                  ? [...ids, a.id]
                                  : ids.filter((x) => x !== a.id),
                              }));
                            }}
                            className="w-4 h-4 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Route {cleanNum(a.routeNumber)} — {a.routeName}
                            </p>
                            <p className="muted">
                              {getAllocDetailForStaff(a, form.staffId)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                            {fmt(amount)}
                          </span>
                        </label>
                      );
                    })}
                    {totalSelected > 0 && (
                      <div className="flex items-center justify-between px-2 pt-1 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          Selected total
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmt(totalSelected)}
                        </span>
                      </div>
                    )}
                  </div>
                </FormField>
              );
            })()}
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
              Save payment
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
