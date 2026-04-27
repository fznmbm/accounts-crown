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
} from "../lib/utils";

function BalancePill({ balance }) {
  if (balance > 0.01)
    return <span className="chip-amber">You owe {fmt(balance)}</span>;
  if (balance < -0.01)
    return <span className="chip-red">Overpaid {fmt(Math.abs(balance))}</span>;
  return <span className="chip-green">Settled</span>;
}

export default function StaffLedger() {
  const { staff, payments, allocations } = useApp();
  const [selected, setSelected] = useState(null);
  const [yearF, setYearF] = useState(() => {
    const s = localStorage.getItem("ledger_year");
    return s !== null ? (s === "all" ? "all" : parseInt(s)) : currentYear();
  });

  // ── Per-staff summary ──────────────────────────────────────────────────────
  const summaries = staff.map((s) => {
    const totalEarned = allocations.reduce((sum, a) => {
      if (a.regularStaffId === s.id) return sum + (a.regularAmount || 0);
      if (a.coverEntries?.length > 0) {
        const entry = a.coverEntries.find((c) => c.staffId === s.id);
        if (entry) return sum + (Number(entry.amount) || 0);
      } else if (a.tempStaffId === s.id) {
        return sum + (a.tempAmount || 0);
      }
      return sum;
    }, 0);
    const totalPaid = payments
      .filter((p) => p.staffId === s.id)
      .reduce((sum, p) => sum + p.amount, 0);

    const balance = totalEarned - totalPaid; // positive = you owe them

    return { ...s, totalEarned, totalPaid, balance };
  });

  // ── Ledger for selected staff member ──────────────────────────────────────
  const getLedger = (staffId) => {
    const s = staff.find((x) => x.id === staffId);
    if (!s) return [];

    // Earnings from allocations — handles regular + multiple cover entries
    const earnLines = [];
    allocations.forEach((a) => {
      // Regular entry
      if (a.regularStaffId === staffId) {
        earnLines.push({
          id: a.id + "_reg",
          type: "earning",
          date: `${a.year}-${String(a.month + 1).padStart(2, "0")}-01`,
          month: a.month,
          year: a.year,
          label: `Route ${a.routeNumber} — ${a.routeName}`,
          detail: `${a.regularDays} days × ${fmt(a.regularRate)}`,
          amount: a.regularAmount || 0,
          sign: 1,
        });
      }
      // Cover entries — use coverEntries array if available, fall back to legacy tempStaffId
      if (a.coverEntries?.length > 0) {
        a.coverEntries.forEach((c, i) => {
          if (c.staffId === staffId) {
            earnLines.push({
              id: a.id + "_cover_" + i,
              type: "earning",
              date: `${a.year}-${String(a.month + 1).padStart(2, "0")}-01`,
              month: a.month,
              year: a.year,
              label: `Route ${a.routeNumber} — ${a.routeName}`,
              detail: `${c.days} days × ${fmt(c.rate)} (cover)`,
              amount: Number(c.amount) || 0,
              sign: 1,
            });
          }
        });
      } else if (a.tempStaffId === staffId) {
        earnLines.push({
          id: a.id + "_temp",
          type: "earning",
          date: `${a.year}-${String(a.month + 1).padStart(2, "0")}-01`,
          month: a.month,
          year: a.year,
          label: `Route ${a.routeNumber} — ${a.routeName}`,
          detail: `${a.tempDays} days × ${fmt(a.tempRate)} (cover)`,
          amount: a.tempAmount || 0,
          sign: 1,
        });
      }
    });

    // Payments made
    const payLines = payments
      .filter((p) => p.staffId === staffId)
      .map((p) => ({
        id: p.id,
        type: "payment",
        date: p.date,
        month: p.month,
        year: p.year,
        label: `Payment — ${MONTHS_SHORT[p.month]} ${p.year}`,
        detail: p.reference || p.type,
        amount: p.amount,
        sign: -1,
      }));

    return [...earnLines, ...payLines].sort((a, b) => {
      // Sort by year+month first, then date
      const aKey = a.year * 100 + a.month;
      const bKey = b.year * 100 + b.month;
      if (aKey !== bKey) return aKey - bKey;
      return new Date(a.date) - new Date(b.date);
    });
  };

  const selectedSummary = selected
    ? summaries.find((s) => s.id === selected)
    : null;
  const ledger = selected ? getLedger(selected) : [];

  // Running balance per ledger line
  let running = 0;
  const ledgerWithRunning = ledger.map((line) => {
    running += line.sign * line.amount;
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Staff Ledger"
        subtitle="Running balances — what each staff member is owed"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: staff list ─────────────────────────────────────────── */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900">
          {summaries.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">
              No staff added yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {summaries.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selected === s.id
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
                          {s.type?.replace("_", " ")}
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
                  <p className="muted mt-0.5">all time</p>
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
                  {selectedSummary.accountNo ? (
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
                  <span className="text-gray-500 dark:text-gray-400">
                    {yearF} balance:{" "}
                    <span
                      className={`font-semibold ${yearEarned - yearPaid > 0 ? "text-amber-600 dark:text-amber-400" : yearEarned - yearPaid < 0 ? "text-red-500" : "text-green-700 dark:text-green-400"}`}
                    >
                      {fmt(yearEarned - yearPaid)}
                    </span>
                  </span>
                </div>
              )}

              {/* Ledger table */}
              {filteredLedger.length === 0 ? (
                <EmptyState
                  icon="📭"
                  title="No transactions"
                  description="No earnings or payments recorded for this period."
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
