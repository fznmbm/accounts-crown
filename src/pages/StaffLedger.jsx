import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import {
  fmt,
  fmtD,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentYear,
  currentMonth,
} from "../lib/utils";
import { categoryLabel } from "../components/DeductionsPanel";

const periodKey = (m, y) => Number(y) * 12 + Number(m);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
// Same key as the Pay run uses for people not on the staff list
const extKey = (name) => `ext:${(name || "").trim().toLowerCase()}`;

function BalancePill({ balance }) {
  if (balance > 0.01)
    return <span className="chip-amber">You owe {fmt(balance)}</span>;
  if (balance < -0.01)
    return <span className="chip-red">Overpaid {fmt(Math.abs(balance))}</span>;
  return <span className="chip-green">Settled</span>;
}

export default function StaffLedger() {
  const { staff, payments, allocations, staffCharges = [] } = useApp();
  const [selected, setSelected] = useState(null); // person key
  const [yearF, setYearF] = useState(() => {
    const s = localStorage.getItem("ledger_year");
    return s !== null ? (s === "all" ? "all" : parseInt(s)) : currentYear();
  });

  // ── Every line for every person (staff by id, external temps by name) ────
  // Same matching rules as the Pay run (lib/monthStatus.js), so both agree.
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const nowKey = periodKey(currentMonth(), currentYear());
  const linesByPerson = new Map();
  const people = new Map();
  const touch = (key, name, isExternal) => {
    if (!people.has(key))
      people.set(key, { key, name: name || "Unknown", isExternal });
    if (!linesByPerson.has(key)) linesByPerson.set(key, []);
    return linesByPerson.get(key);
  };
  staff.forEach((s) => touch(`staff:${s.id}`, s.name, false));

  const addEarning = ({ staffId, name, a, suffix, detail, amount }) => {
    amount = Number(amount) || 0;
    if (amount <= 0 || (!staffId && !name)) return;
    const key = staffId ? `staff:${staffId}` : extKey(name);
    touch(key, staffById.get(staffId)?.name || name, !staffId).push({
      id: `${a.id}_${suffix}`,
      type: "earning",
      date: `${a.year}-${String(Number(a.month) + 1).padStart(2, "0")}-01`,
      month: Number(a.month),
      year: Number(a.year),
      label: `Route ${a.routeNumber} — ${a.routeName}`,
      detail,
      amount,
    });
  };

  allocations.forEach((a) => {
    if (a.regularStaffId)
      addEarning({
        staffId: a.regularStaffId,
        a,
        suffix: "reg",
        detail: `${a.regularDays} days × ${fmt(a.regularRate)}`,
        amount: a.regularAmount,
      });
    if (a.paStaffId)
      addEarning({
        staffId: a.paStaffId,
        name: a.paStaffName,
        a,
        suffix: "pa",
        detail: `${a.paDays} days × ${fmt(a.paRate)} (PA)`,
        amount: a.paAmount,
      });
    if (a.coverEntries?.length > 0) {
      a.coverEntries.forEach((c, i) => {
        const onList = c.staffId && !c.isExternal && staffById.has(c.staffId);
        addEarning({
          staffId: onList ? c.staffId : null,
          name: c.staffName,
          a,
          suffix: `cover_${i}`,
          detail: `${c.days} days × ${fmt(c.rate)} (cover)`,
          amount: c.amount,
        });
      });
    } else if (Number(a.tempAmount) > 0) {
      const onList = a.tempStaffId && staffById.has(a.tempStaffId);
      addEarning({
        staffId: onList ? a.tempStaffId : null,
        name: a.tempStaffName,
        a,
        suffix: "temp",
        detail: `${a.tempDays} days × ${fmt(a.tempRate)} (cover)`,
        amount: a.tempAmount,
      });
    }
    (a.additiveEntries || []).forEach((e, i) => {
      if (!e.staffId) return;
      const isMain = e.staffId === a.regularStaffId;
      const onList = staffById.has(e.staffId);
      addEarning({
        staffId: isMain || onList ? e.staffId : null,
        name: e.staffName,
        a,
        suffix: `additive_${i}`,
        detail: `${e.days} days × ${fmt(e.rate)} (${e.description || "extra"})`,
        amount: e.amount,
      });
    });
  });

  // Payments — against the work month they were for
  payments.forEach((p) => {
    const key =
      !p.isExternal && p.staffId
        ? `staff:${p.staffId}`
        : extKey(p.externalName);
    const month = Number(p.periodMonth ?? p.month);
    const year = Number(p.periodYear ?? p.year);
    touch(
      key,
      p.isExternal ? p.externalName : staffById.get(p.staffId)?.name,
      !!p.isExternal || !p.staffId,
    ).push({
      id: p.id,
      type: "payment",
      date: p.date,
      month,
      year,
      label: `Payment — ${MONTHS_SHORT[month]} ${year}`,
      detail: p.reference || p.type,
      amount: Number(p.amount) || 0,
    });
  });

  // Deductions — in the month they are due; later instalments listed apart
  const upcomingByPerson = new Map();
  staffCharges
    .filter((c) => c.status !== "waived")
    .forEach((c) => {
      const key =
        !c.isExternal && c.staffId ? `staff:${c.staffId}` : extKey(c.staffName);
      const list = touch(key, c.staffName, !!c.isExternal || !c.staffId);
      const k = periodKey(c.deductMonth, c.deductYear);
      if (k > nowKey) {
        if (c.status === "outstanding") {
          if (!upcomingByPerson.has(key)) upcomingByPerson.set(key, []);
          upcomingByPerson.get(key).push(c);
        }
        return;
      }
      list.push({
        id: c.id,
        type: "deduction",
        date: `${c.deductYear}-${String(c.deductMonth + 1).padStart(2, "0")}-28`,
        month: c.deductMonth,
        year: c.deductYear,
        label: `Deduction — ${categoryLabel(c.category)}${c.description ? `: ${c.description}` : ""}`,
        detail:
          (c.instalments > 1
            ? `${c.instalmentNo} of ${c.instalments} · `
            : "") + (c.status === "deducted" ? "deducted" : "to deduct"),
        status: c.status,
        amount: Number(c.amount) || 0,
      });
    });

  const sign = (l) => (l.type === "earning" ? 1 : -1);
  const sumOf = (lines, type) =>
    round2(
      lines.filter((l) => l.type === type).reduce((s, l) => s + l.amount, 0),
    );

  // ── Per-person summary ─────────────────────────────────────────────────────
  const summaries = [...people.values()]
    .map((p) => {
      const lines = linesByPerson.get(p.key) || [];
      const s = p.key.startsWith("staff:")
        ? staffById.get(p.key.slice(6))
        : null;
      const totalEarned = sumOf(lines, "earning");
      const totalPaid = sumOf(lines, "payment");
      const totalDeducted = sumOf(lines, "deduction");
      return {
        ...(s || {}),
        key: p.key,
        name: s?.name || p.name,
        isExternal: !s,
        totalEarned,
        totalPaid,
        totalDeducted,
        balance: round2(totalEarned - totalPaid - totalDeducted), // + = we owe them
      };
    })
    // External temps only show if they have any lines
    .filter((p) => !p.isExternal || (linesByPerson.get(p.key) || []).length)
    .sort(
      (a, b) =>
        Number(a.isExternal) - Number(b.isExternal) ||
        (a.isExternal ? a.name.localeCompare(b.name) : 0),
    );

  // ── Ledger for the selected person ────────────────────────────────────────
  const TYPE_ORDER = { earning: 0, deduction: 1, payment: 2 };
  const getLedger = (key) =>
    [...(linesByPerson.get(key) || [])].sort(
      (a, b) =>
        a.year * 100 + a.month - (b.year * 100 + b.month) ||
        TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
        new Date(a.date) - new Date(b.date),
    );

  const selectedSummary = selected
    ? summaries.find((s) => s.key === selected)
    : null;
  const ledger = selected ? getLedger(selected) : [];

  // Running balance per ledger line
  let running = 0;
  const ledgerWithRunning = ledger.map((line) => {
    running = round2(running + sign(line) * line.amount);
    return { ...line, running };
  });

  // Filter ledger by year
  const filteredLedger =
    yearF === "all"
      ? ledgerWithRunning
      : ledgerWithRunning.filter((l) => l.year === Number(yearF));

  // Year earnings/paid for selected staff
  const yearEarned = filteredLedger
    .filter((l) => l.type === "earning")
    .reduce((s, l) => s + l.amount, 0);
  const yearPaid = filteredLedger
    .filter((l) => l.type === "payment")
    .reduce((s, l) => s + l.amount, 0);
  const yearDeducted = filteredLedger
    .filter((l) => l.type === "deduction")
    .reduce((s, l) => s + l.amount, 0);
  const yearBalance = round2(yearEarned - yearPaid - yearDeducted);
  const upcoming = selected ? upcomingByPerson.get(selected) || [] : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Staff Ledger"
        subtitle="Running balances — what each staff member is owed"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: staff list ─────────────────────────────────────────── */}
        <div className="w-48 md:w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900">
          {summaries.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">
              No staff added yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {summaries.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSelected(s.key)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selected === s.key
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 avatar text-sm flex-shrink-0">
                        {s.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {s.name}
                        </p>
                        <p className="muted capitalize">
                          {s.isExternal
                            ? "External temp"
                            : s.type?.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <BalancePill balance={s.balance} />
                    </div>
                  </div>
                  {s.balance !== 0 && (
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Earned: {fmt(s.totalEarned)}</span>
                      <span>Paid: {fmt(s.totalPaid)}</span>
                    </div>
                  )}
                  {s.totalDeducted > 0 && (
                    <div className="mt-0.5 text-right text-xs text-amber-600 dark:text-amber-400">
                      Deducted: {fmt(s.totalDeducted)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: ledger detail ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <EmptyState
              icon="👈"
              title="Select a staff member"
              description="Choose a staff member from the list to view their full ledger."
            />
          ) : (
            <div className="p-6 space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="metric">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Total earned
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(selectedSummary.totalEarned)}
                  </p>
                  <p className="muted mt-0.5">all time</p>
                </div>
                <div className="metric">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Total paid
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(selectedSummary.totalPaid)}
                  </p>
                  <p className="muted mt-0.5">
                    {selectedSummary.totalDeducted > 0
                      ? `+ ${fmt(selectedSummary.totalDeducted)} deducted`
                      : "all time"}
                  </p>
                </div>
                <div className="metric">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Balance
                  </p>
                  <p
                    className={`text-xl font-semibold ${
                      selectedSummary.balance > 0.01
                        ? "text-amber-600 dark:text-amber-400"
                        : selectedSummary.balance < -0.01
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {selectedSummary.balance > 0.01
                      ? `Owe ${fmt(selectedSummary.balance)}`
                      : selectedSummary.balance < -0.01
                        ? `Overpaid ${fmt(Math.abs(selectedSummary.balance))}`
                        : "Settled"}
                  </p>
                  <p className="muted mt-0.5">current</p>
                </div>
                <div className="metric">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Bank details
                  </p>
                  {selectedSummary.isExternal ? (
                    <p className="muted">External temp — not on staff list</p>
                  ) : selectedSummary.accountNo ? (
                    <>
                      <p className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {selectedSummary.sortCode}
                      </p>
                      <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {selectedSummary.accountNo}
                      </p>
                    </>
                  ) : (
                    <p className="muted">Not set</p>
                  )}
                </div>
              </div>

              {/* Year filter */}
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Transaction history
                </p>
                <select
                  className="input w-28 ml-auto"
                  value={yearF}
                  onChange={(e) => {
                    const v =
                      e.target.value === "all" ? "all" : Number(e.target.value);
                    setYearF(v);
                    localStorage.setItem("ledger_year", v);
                  }}
                >
                  <option value="all">All time</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year summary */}
              {yearF !== "all" && (
                <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {yearF} earned:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(yearEarned)}
                    </span>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {yearF} paid:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(yearPaid)}
                    </span>
                  </span>
                  {yearDeducted > 0 && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {yearF} deducted:{" "}
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {fmt(yearDeducted)}
                      </span>
                    </span>
                  )}
                  <span className="text-gray-500 dark:text-gray-400">
                    {yearF} balance:{" "}
                    <span
                      className={`font-semibold ${yearBalance > 0.01 ? "text-amber-600 dark:text-amber-400" : yearBalance < -0.01 ? "text-red-500" : "text-green-700 dark:text-green-400"}`}
                    >
                      {fmt(yearBalance)}
                    </span>
                  </span>
                </div>
              )}

              {/* Ledger table */}
              {filteredLedger.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No transactions"
                  description="No earnings, payments or deductions recorded for this period."
                />
              ) : (
                <div className="card overflow-hidden">
                  <table className="min-w-full">
                    <thead>
                      <tr className="thead-row">
                        <th className="th">Period</th>
                        <th className="th">Description</th>
                        <th className="th">Detail</th>
                        <th className="th-r">Earned</th>
                        <th className="th-r">Paid</th>
                        <th className="th-r">Deducted</th>
                        <th className="th-r">Running balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredLedger.map((line) => (
                        <tr
                          key={line.id}
                          className={`tr ${
                            line.type === "earning"
                              ? "bg-transparent"
                              : line.type === "deduction"
                                ? "bg-amber-50/40 dark:bg-amber-900/10"
                                : "bg-blue-50/30 dark:bg-blue-900/10"
                          }`}
                        >
                          <td className="td text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {MONTHS_SHORT[line.month]} {line.year}
                          </td>
                          <td className="td">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  line.type === "earning"
                                    ? "bg-green-500"
                                    : line.type === "deduction"
                                      ? "bg-amber-500"
                                      : "bg-blue-500"
                                }`}
                              />
                              <span className="text-sm text-gray-900 dark:text-gray-100">
                                {line.label}
                              </span>
                            </div>
                          </td>
                          <td className="td text-xs text-gray-500 dark:text-gray-400">
                            {line.detail}
                          </td>
                          <td className="td-r font-medium text-green-700 dark:text-green-400">
                            {line.type === "earning" ? fmt(line.amount) : "—"}
                          </td>
                          <td className="td-r font-medium text-blue-700 dark:text-blue-400">
                            {line.type === "payment" ? fmt(line.amount) : "—"}
                          </td>
                          <td className="td-r font-medium text-amber-600 dark:text-amber-400">
                            {line.type === "deduction" ? fmt(line.amount) : "—"}
                          </td>
                          <td
                            className={`td-r font-semibold ${
                              line.running > 0.01
                                ? "text-amber-600 dark:text-amber-400"
                                : line.running < -0.01
                                  ? "text-red-600  dark:text-red-400"
                                  : "text-green-700 dark:text-green-400"
                            }`}
                          >
                            {line.running > 0.01
                              ? `Owe ${fmt(line.running)}`
                              : line.running < -0.01
                                ? `+${fmt(Math.abs(line.running))} credit`
                                : "✓ Settled"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Later instalments — not in the balance yet */}
              {upcoming.length > 0 && (
                <div className="px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 text-sm">
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    Upcoming deductions (not in the balance yet)
                  </p>
                  <ul className="space-y-0.5 text-amber-800 dark:text-amber-300">
                    {[...upcoming]
                      .sort(
                        (a, b) =>
                          periodKey(a.deductMonth, a.deductYear) -
                          periodKey(b.deductMonth, b.deductYear),
                      )
                      .map((c) => (
                        <li key={c.id} className="flex justify-between gap-3">
                          <span>
                            {MONTHS_SHORT[c.deductMonth]} {c.deductYear} —{" "}
                            {categoryLabel(c.category)}
                            {c.instalments > 1
                              ? ` (${c.instalmentNo} of ${c.instalments})`
                              : ""}
                          </span>
                          <span className="font-semibold">{fmt(c.amount)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
