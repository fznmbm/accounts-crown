// ── Pay run: who do I pay for this work month? ──────────────────────────────
// Everyone with money due — regular, cover, PA, external temps — plus anyone
// with a balance still open from earlier months. Numbers come from
// getPayables() in lib/monthStatus.js, so every screen agrees.
import { Fragment, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import MetricCard from "./MetricCard";
import EmptyState from "./EmptyState";
import { getPayables } from "../lib/monthStatus";
import { categoryLabel } from "./DeductionsPanel";
import {
  fmt,
  fmtD,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
} from "../lib/utils";

const CATEGORY_CHIP = {
  regular: { cls: "chip-blue", label: "Regular" },
  cover: { cls: "chip-gray", label: "Cover" },
  external: { cls: "chip-amber", label: "External" },
};

const readStored = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : Number(v);
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
};

// onPay(row, month, year) — opens the payment form pre-filled for this person
export default function PayRun({ onPay }) {
  const { allocations, staff, payments, staffCharges = [] } = useApp();
  const [month, setMonth] = useState(() =>
    readStored("payrun_month", currentMonth()),
  );
  const [year, setYear] = useState(() =>
    readStored("payrun_year", currentYear()),
  );
  const [hideSettled, setHideSettled] = useState(true);
  const [openKey, setOpenKey] = useState(null);

  const { rows, summary } = useMemo(
    () =>
      getPayables({ month, year, allocations, staff, payments, staffCharges }),
    [month, year, allocations, staff, payments, staffCharges],
  );
  const shown = hideSettled ? rows.filter((r) => !r.settled) : rows;

  const totals = shown.reduce(
    (t, r) => ({
      bf: t.bf + r.broughtForward,
      earned: t.earned + r.earned,
      paid: t.paid + r.paid,
      ded: t.ded + r.deductions,
      net: t.net + r.netToPay,
    }),
    { bf: 0, earned: 0, paid: 0, ded: 0, net: 0 },
  );

  const money = (n, { dash = true } = {}) =>
    dash && Math.abs(n) < 0.005 ? (
      <span className="text-gray-300 dark:text-gray-600">—</span>
    ) : (
      fmt(n)
    );

  // Earned / paid / deductions breakdown — used by the table and phone cards
  const renderBreakdown = (r) => (
    <div className="grid md:grid-cols-3 gap-6 text-sm">
      <div>
        <p className="label mb-2">
          Earned in {MONTHS_SHORT[month]} {year}
        </p>
        {r.earnedLines.length === 0 ? (
          <p className="muted">Nothing this month</p>
        ) : (
          <ul className="space-y-1">
            {r.earnedLines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-400">
                  {l.routeLabel} · {l.role}
                  {l.days ? ` · ${l.days} days` : ""}
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {fmt(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {Math.abs(r.broughtForward) > 0.005 && (
          <p className="muted mt-2">
            {r.broughtForward > 0
              ? `Plus ${fmt(r.broughtForward)} still owed from earlier months`
              : `Minus ${fmt(-r.broughtForward)} overpaid or deducted from earlier months`}
          </p>
        )}
      </div>

      <div>
        <p className="label mb-2">Paid for {MONTHS_SHORT[month]}</p>
        {r.paymentsThisMonth.length === 0 ? (
          <p className="muted">No payments yet</p>
        ) : (
          <ul className="space-y-1">
            {r.paymentsThisMonth.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-400">
                  {fmtD(p.date)} · {p.type}
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {fmt(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="label mb-2">Deductions</p>
        {r.outstandingCharges.length === 0 && r.upcomingCharges.length === 0 ? (
          <p className="muted">None</p>
        ) : (
          <ul className="space-y-1">
            {r.outstandingCharges.map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span className="text-amber-700 dark:text-amber-400">
                  {categoryLabel(c.category)}
                  {c.description ? ` — ${c.description}` : ""}
                  {c.instalments > 1
                    ? ` (${c.instalmentNo}/${c.instalments})`
                    : ""}
                </span>
                <span className="text-amber-700 dark:text-amber-400">
                  {fmt(c.amount)}
                </span>
              </li>
            ))}
            {r.upcomingCharges.map((c) => (
              <li
                key={c.id}
                className="flex justify-between gap-3 text-gray-400 dark:text-gray-500"
              >
                <span>
                  Later: {MONTHS_SHORT[c.deductMonth]} {c.deductYear} ·{" "}
                  {categoryLabel(c.category)}
                </span>
                <span>{fmt(c.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const chipFor = (r) =>
    CATEGORY_CHIP[r.category] || (r.isExternal ? CATEGORY_CHIP.external : null);
  const toDeduct = (r) =>
    r.outstandingCharges.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Work month
        </span>
        <select
          className="input w-36"
          value={month}
          onChange={(e) => {
            setMonth(Number(e.target.value));
            store("payrun_month", e.target.value);
          }}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="input w-28"
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            store("payrun_year", e.target.value);
          }}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer ml-auto">
          <input
            type="checkbox"
            className="w-4 h-4 rounded"
            checked={hideSettled}
            onChange={(e) => setHideSettled(e.target.checked)}
          />
          Hide settled
        </label>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Still to pay"
          value={fmt(summary.totalToPay)}
          sub={`${summary.toPay} ${summary.toPay === 1 ? "person" : "people"}`}
          color={summary.totalToPay > 0 ? "amber" : "green"}
        />
        <MetricCard
          label={`Earned in ${MONTHS_SHORT[month]}`}
          value={fmt(summary.totalEarned)}
        />
        <MetricCard
          label="Deductions due"
          value={fmt(summary.totalDeductions)}
          sub={
            summary.withDeductions
              ? `${summary.withDeductions} with deductions to take off`
              : "None outstanding"
          }
          color={summary.withDeductions ? "amber" : undefined}
        />
        <MetricCard
          label="Overpaid"
          value={summary.overpaid}
          sub={
            summary.overpaid ? "Check these — they owe you" : "Nobody overpaid"
          }
          color={summary.overpaid ? "red" : "green"}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="✅"
          title={
            rows.length ? "Everyone is settled" : "Nothing due for this month"
          }
          description={
            rows.length
              ? "Untick 'Hide settled' to see everyone."
              : "No earnings, payments or deductions for this work month yet."
          }
        />
      ) : (
        <>
          {/* Phones: one card per person */}
          <div className="md:hidden space-y-2">
            {shown.map((r) => {
              const isOpen = openKey === r.key;
              const chip = chipFor(r);
              return (
                <div
                  key={r.key}
                  className={`card p-4 ${r.hasDeductions ? "border-amber-300 dark:border-amber-700" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {r.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chip && <span className={chip.cls}>{chip.label}</span>}
                        {r.hasDeductions && (
                          <span className="chip-amber">
                            ⚠ {fmt(toDeduct(r))} to deduct
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`text-base font-semibold ${
                          r.overpaid
                            ? "text-red-600 dark:text-red-400"
                            : r.settled
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {r.settled ? "Settled" : fmt(r.netToPay)}
                      </p>
                      <p className="muted">
                        {r.overpaid
                          ? "overpaid"
                          : r.settled
                            ? ""
                            : "net to pay"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Brought forward</span>
                    <span className="text-right">
                      {money(r.broughtForward)}
                    </span>
                    <span>Earned</span>
                    <span className="text-right text-gray-900 dark:text-gray-100">
                      {money(r.earned)}
                    </span>
                    <span>Paid</span>
                    <span className="text-right">{money(r.paid)}</span>
                    <span>Deductions</span>
                    <span className="text-right text-amber-600 dark:text-amber-400">
                      {r.deductions ? `− ${fmt(r.deductions)}` : money(0)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn-secondary flex-1 text-sm"
                      onClick={() => setOpenKey(isOpen ? null : r.key)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? "Hide details" : "Details"}
                    </button>
                    {r.netToPay > 0.01 && (
                      <button
                        type="button"
                        className="btn-primary flex-1 text-sm"
                        onClick={() => onPay?.(r, month, year)}
                      >
                        Pay {fmt(r.netToPay)}
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      {renderBreakdown(r)}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="card p-4 flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
              <span>Total net to pay ({shown.length})</span>
              <span>{fmt(totals.net)}</span>
            </div>
          </div>

          {/* Tablets and desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="thead-row">
                  <th className="th">Person</th>
                  <th className="th-r">Brought forward</th>
                  <th className="th-r">Earned</th>
                  <th className="th-r">Paid</th>
                  <th className="th-r">Deductions</th>
                  <th className="th-r">Net to pay</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {shown.map((r) => {
                  const isOpen = openKey === r.key;
                  const chip =
                    CATEGORY_CHIP[r.category] ||
                    (r.isExternal ? CATEGORY_CHIP.external : null);
                  return (
                    <Fragment key={r.key}>
                      <tr
                        className={`tr cursor-pointer ${r.hasDeductions ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                        onClick={() => setOpenKey(isOpen ? null : r.key)}
                      >
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs w-3">
                              {isOpen ? "▾" : "▸"}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {r.name}
                            </span>
                            {chip && (
                              <span className={chip.cls}>{chip.label}</span>
                            )}
                            {r.hasDeductions && (
                              <span
                                className="chip-amber"
                                title="Deductions to take off"
                              >
                                ⚠{" "}
                                {fmt(
                                  r.outstandingCharges.reduce(
                                    (s, c) => s + c.amount,
                                    0,
                                  ),
                                )}{" "}
                                to deduct
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="td-r text-gray-600 dark:text-gray-400">
                          {money(r.broughtForward)}
                        </td>
                        <td className="td-r text-gray-900 dark:text-gray-100">
                          {money(r.earned)}
                        </td>
                        <td className="td-r text-gray-600 dark:text-gray-400">
                          {money(r.paid)}
                        </td>
                        <td className="td-r text-amber-600 dark:text-amber-400">
                          {r.deductions ? `− ${fmt(r.deductions)}` : money(0)}
                        </td>
                        <td
                          className={`td-r font-semibold ${
                            r.overpaid
                              ? "text-red-600 dark:text-red-400"
                              : r.settled
                                ? "text-green-600 dark:text-green-400"
                                : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {r.settled ? "Settled" : fmt(r.netToPay)}
                          {r.overpaid && (
                            <span className="block text-xs font-normal">
                              overpaid
                            </span>
                          )}
                        </td>
                        <td className="td" onClick={(e) => e.stopPropagation()}>
                          {r.netToPay > 0.01 && (
                            <button
                              className="btn-primary text-xs px-3 py-1"
                              onClick={() => onPay?.(r, month, year)}
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50"
                          >
                            {renderBreakdown(r)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold">
                  <td className="td text-gray-900 dark:text-gray-100">
                    Total ({shown.length})
                  </td>
                  <td className="td-r text-gray-600 dark:text-gray-400">
                    {fmt(totals.bf)}
                  </td>
                  <td className="td-r text-gray-900 dark:text-gray-100">
                    {fmt(totals.earned)}
                  </td>
                  <td className="td-r text-gray-600 dark:text-gray-400">
                    {fmt(totals.paid)}
                  </td>
                  <td className="td-r text-amber-600 dark:text-amber-400">
                    {fmt(totals.ded)}
                  </td>
                  <td className="td-r text-gray-900 dark:text-gray-100">
                    {fmt(totals.net)}
                  </td>
                  <td className="td"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
