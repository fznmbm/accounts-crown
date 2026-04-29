import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import {
  uid,
  fmt,
  fmtD,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
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
};

export default function Payments() {
  const { payments, setPayments, staff, allocations, submissions } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [staffF, setStaffF] = useState("all");
  const [monthF, setMonthF] = useState("all");
  const [yearF, setYearF] = useState(
    () => localStorage.getItem("pay_yearF") || String(currentYear()),
  );

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
    });
    setEditing(p);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = () => {
    if ((!form.staffId && !form.externalName) || !form.amount) return;
    const record = {
      id: editing?.id || uid(),
      ...form,
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
    setPayments(
      editing
        ? payments.map((x) => (x.id === editing.id ? record : x))
        : [...payments, record],
      {
        action: editing ? "update" : "create",
        id: record.id,
        label: `Payment to ${name} — ${fmt(record.amount)}`,
      },
    );
    close();
  };

  const del = (id) => {
    if (confirm("Delete this payment?")) {
      const p = payments.find((x) => x.id === id);
      setPayments(
        payments.filter((x) => x.id !== id),
        {
          action: "delete",
          id,
          label: `Payment to ${staff.find((s) => s.id === p?.staffId)?.name} — ${fmt(p?.amount)}`,
        },
      );
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
        subtitle="Log regular, advance and partial payments"
        actions={
          <button className="btn-primary" onClick={open}>
            + Log payment
          </button>
        }
      />
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
                            {p.isExternal ? p.externalName : getName(p.staffId)}
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
                        <button className="btn-ghost" onClick={() => edit(p)}>
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
                  onChange={f("externalName")}
                  placeholder="e.g. Ahmed Khan — ABC Taxis"
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
                  onChange={f("month")}
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
                  onChange={f("year")}
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

            {/* Link to allocations */}
            {(() => {
              const staffAllocs = allocations.filter(
                (a) =>
                  (a.regularStaffId === form.staffId ||
                    a.tempStaffId === form.staffId) &&
                  a.month === Number(form.month) &&
                  a.year === Number(form.year),
              );
              if (staffAllocs.length === 0) return null;
              const totalSelected = staffAllocs
                .filter((a) => (form.allocationIds || []).includes(a.id))
                .reduce(
                  (s, a) =>
                    s +
                    (a.regularStaffId === form.staffId
                      ? a.regularAmount || 0
                      : a.tempAmount || 0),
                  0,
                );
              return (
                <FormField
                  label="Settles allocations"
                  hint="Tick which routes this payment covers"
                >
                  <div className="space-y-2 mt-1">
                    {staffAllocs.map((a) => {
                      const amount =
                        a.regularStaffId === form.staffId
                          ? a.regularAmount
                          : a.tempAmount;
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
                              Route {a.routeNumber} — {a.routeName}
                            </p>
                            <p className="muted">
                              {a.regularStaffId === form.staffId
                                ? a.regularDays
                                : a.tempDays}{" "}
                              days ×{" "}
                              {fmt(
                                a.regularStaffId === form.staffId
                                  ? a.regularRate
                                  : a.tempRate,
                              )}
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
