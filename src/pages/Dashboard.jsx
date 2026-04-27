import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import MetricCard from "../components/MetricCard";
import Badge from "../components/Badge";
import {
  fmt,
  fmtD,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
} from "../lib/utils";

export default function Dashboard() {
  const {
    invoices,
    staff,
    payments,
    remittances,
    routes,
    settings,
    allocations,
    pupils,
  } = useApp();
  const [month, setMonth] = useState(() => {
    const s = localStorage.getItem("dash_month");
    return s !== null ? parseInt(s) : currentMonth();
  });
  const [year, setYear] = useState(() => {
    const s = localStorage.getItem("dash_year");
    return s !== null ? parseInt(s) : currentYear();
  });

  const mi = invoices.filter((x) => x.month === month && x.year === year);
  const invoiced = mi.reduce((s, x) => s + (x.total || 0), 0);
  const received = mi.reduce((s, x) => s + (x.paidAmount || 0), 0);
  const outstanding = invoiced - received;
  const vatCollected = mi.reduce((s, x) => s + (x.vat || 0), 0);
  const mp = payments.filter((p) => p.month === month && p.year === year);
  const cost = mp.reduce((s, p) => s + p.amount, 0);
  const vatRate = settings?.vatRate || 20;
  const netReceived = received / (1 + vatRate / 100);
  const profit = netReceived - cost;
  const unpaid = mi.filter((x) => x.status !== "paid");
  // Routes with invoices this month but no allocation
  const missingAllocations = mi.filter(
    (inv) =>
      !allocations.some(
        (a) =>
          a.routeNumber === inv.routeNumber &&
          a.month === month &&
          a.year === year,
      ),
  );
  const recentRem = [...remittances]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const divider = "border-b border-gray-100 dark:border-gray-700";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Dashboard"
        subtitle="Crown Cars Ltd — Account overview"
        actions={
          <div className="flex gap-2">
            <select
              className="input w-36"
              value={month}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMonth(v);
                localStorage.setItem("dash_month", v);
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className="input w-24"
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(v);
                localStorage.setItem("dash_year", v);
              }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="page-body">
        {/* KPIs */}
        <div className="grid grid-cols-6 gap-3">
          <MetricCard
            label="Total invoiced"
            value={fmt(invoiced)}
            color="blue"
          />
          <MetricCard
            label="Received (WSCC)"
            value={fmt(received)}
            color="green"
          />
          <MetricCard
            label="Outstanding"
            value={fmt(outstanding)}
            color={outstanding > 0 ? "amber" : "gray"}
          />
          <MetricCard label="Staff paid" value={fmt(cost)} />
          <MetricCard
            label="Net profit"
            value={fmt(profit)}
            color={profit >= 0 ? "green" : "red"}
            sub="ex-VAT"
          />
          <MetricCard
            label="VAT collected"
            value={fmt(vatCollected)}
            color="blue"
          />
        </div>

        {/* Unpaid alert */}
        {unpaid.length > 0 && (
          <div className="alert-warn">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 dark:text-amber-400 text-lg mt-0.5">
                ⚠
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                  {unpaid.length} invoice{unpaid.length > 1 ? "s" : ""} require
                  chasing — {MONTHS[month]} {year}
                </p>
                <div className="flex flex-wrap gap-2">
                  {unpaid.map((x) => (
                    <Link
                      key={x.id}
                      to="/invoices"
                      className="inline-flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
                    >
                      #{x.invoiceNumber}
                      <span className="font-semibold">
                        {fmt((x.total || 0) - (x.paidAmount || 0))} outstanding
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {missingAllocations.length > 0 && (
          <div className="alert-info">
            <div className="flex items-start gap-3">
              <span className="text-blue-500 dark:text-blue-400 text-lg mt-0.5">
                ℹ
              </span>
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  {missingAllocations.length} invoice
                  {missingAllocations.length > 1 ? "s" : ""} have no allocation
                  — staff costs unknown for {MONTHS[month]} {year}
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingAllocations.map((x) => (
                    <Link
                      key={x.id}
                      to="/allocations"
                      className="inline-flex items-center gap-1 text-xs bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                    >
                      Route {x.routeNumber} — {x.routeName}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-2 gap-5">
          {/* Recent remittances */}
          <div className="card p-5 flex flex-col max-h-72">
            <div
              className={`flex items-center justify-between mb-4 pb-3 ${divider}`}
            >
              <h3 className="section-title">Recent remittances</h3>
              <Link
                to="/remittances"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all
              </Link>
            </div>
            {recentRem.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No remittances yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentRem.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Payment #{r.paymentNumber}
                      </p>
                      <p className="muted mt-0.5">
                        {r.items?.length} invoices · {fmtD(r.paymentDate)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                      {fmt(r.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staff balances */}
          <div className="card p-5 flex flex-col max-h-72">
            <div
              className={`flex items-center justify-between mb-4 pb-3 ${divider}`}
            >
              <h3 className="section-title">Staff balances</h3>
              <Link
                to="/staff-ledger"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full ledger
              </Link>
            </div>
            {staff.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No staff added yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto flex-1">
                {staff.map((s) => {
                  const earned = allocations
                    .filter(
                      (a) =>
                        a.regularStaffId === s.id || a.tempStaffId === s.id,
                    )
                    .reduce(
                      (sum, a) =>
                        sum +
                        (a.regularStaffId === s.id
                          ? a.regularAmount || 0
                          : a.tempAmount || 0),
                      0,
                    );
                  const paid = payments
                    .filter((p) => p.staffId === s.id)
                    .reduce((sum, p) => sum + p.amount, 0);
                  const balance = earned - paid;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 avatar text-xs">
                          {s.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {s.name}
                          </p>
                          <p className="muted capitalize">
                            {s.type?.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {earned === 0 ? (
                          <span className="muted text-xs">—</span>
                        ) : balance > 0.01 ? (
                          <div>
                            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                              Owe {fmt(balance)}
                            </p>
                            <p className="muted">
                              {fmt(paid)} paid of {fmt(earned)}
                            </p>
                          </div>
                        ) : balance < -0.01 ? (
                          <div>
                            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                              Overpaid {fmt(Math.abs(balance))}
                            </p>
                            <p className="muted">
                              {fmt(paid)} paid of {fmt(earned)}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                              ✓ Settled
                            </p>
                            <p className="muted">{fmt(paid)} paid</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active routes */}
          <div className="card p-5">
            <div
              className={`flex items-center justify-between mb-4 pb-3 ${divider}`}
            >
              <h3 className="section-title">Active routes</h3>
              <Link
                to="/routes"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Manage
              </Link>
            </div>
            {routes.filter((r) => r.active).length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No routes yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {routes
                  .filter((r) => r.active)
                  .slice(0, 5)
                  .map((r) => {
                    const driver = staff.find(
                      (s) => s.id === r.primaryDriverId,
                    );
                    const childCount = pupils.filter(
                      (p) => p.routeId === r.id && p.status === "active",
                    ).length;
                    const needsPA = pupils.some(
                      (p) =>
                        p.routeId === r.id &&
                        p.requiresPA &&
                        p.status === "active",
                    );
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between py-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Route {r.number}
                            </p>
                            {r.suspended && (
                              <span className="chip-amber text-xs">
                                Suspended
                              </span>
                            )}
                          </div>
                          <p className="muted">
                            {r.name} · {driver?.name || "No driver"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {childCount > 0 && (
                              <span className="text-xs text-purple-600 dark:text-purple-400">
                                🧒 {childCount} child
                                {childCount !== 1 ? "ren" : ""}
                              </span>
                            )}
                            {needsPA && (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                ⚠ PA required
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {fmt(r.dailyRate)}/day
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* This month invoices */}
          <div className="card p-5">
            <div
              className={`flex items-center justify-between mb-4 pb-3 ${divider}`}
            >
              <h3 className="section-title">
                Invoices — {MONTHS_SHORT[month]} {year}
              </h3>
              <Link
                to="/invoices"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View all
              </Link>
            </div>
            {mi.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                No invoices this month
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {mi.slice(0, 5).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        #{inv.invoiceNumber}
                      </p>
                      <p className="muted">
                        Route {inv.routeNumber} · {inv.routeName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge type={inv.status} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(inv.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cash flow widget */}
        <div className="card p-5">
          <div
            className={`flex items-center justify-between mb-4 pb-3 ${divider}`}
          >
            <div>
              <h3 className="section-title">
                Cash flow — {MONTHS[month]} {year}
              </h3>
              <p className="muted mt-0.5">
                Expected income vs committed staff costs
              </p>
            </div>
            <Link
              to="/allocations"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Manage allocations
            </Link>
          </div>

          {(() => {
            // Expected from WSCC this month (unpaid invoices)
            const expectedFromWSCC = mi.reduce(
              (s, x) => s + ((x.total || 0) - (x.paidAmount || 0)),
              0,
            );
            const alreadyReceived = mi.reduce(
              (s, x) => s + (x.paidAmount || 0),
              0,
            );
            const vatRate = settings?.vatRate || 20;

            // Staff owed this month from allocations
            const monthAllocs = allocations.filter(
              (a) => a.month === month && a.year === year,
            );
            const totalOwedStaff = monthAllocs.reduce(
              (s, a) => s + (a.regularAmount || 0) + (a.tempAmount || 0),
              0,
            );

            // Staff already paid this month
            const alreadyPaidStaff = payments
              .filter((p) => p.month === month && p.year === year)
              .reduce((s, p) => s + p.amount, 0);

            const stillOwedStaff = Math.max(
              0,
              totalOwedStaff - alreadyPaidStaff,
            );

            // Net position — what's left after paying remaining staff from expected WSCC
            const netPosition =
              (alreadyReceived + expectedFromWSCC) / (1 + vatRate / 100) -
              totalOwedStaff;
            const canPayStaff = expectedFromWSCC >= stillOwedStaff;

            return (
              <div className="space-y-4">
                {/* Bar visual */}
                <div className="space-y-2">
                  {/* WSCC income bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">
                        WSCC income
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {fmt(alreadyReceived + expectedFromWSCC)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full flex rounded-full overflow-hidden">
                        <div
                          className="bg-green-500 dark:bg-green-600 transition-all"
                          style={{
                            width: `${alreadyReceived + expectedFromWSCC > 0 ? (alreadyReceived / (alreadyReceived + expectedFromWSCC)) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-green-200 dark:bg-green-900 transition-all"
                          style={{
                            width: `${alreadyReceived + expectedFromWSCC > 0 ? (expectedFromWSCC / (alreadyReceived + expectedFromWSCC)) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-600 inline-block" />
                        Received {fmt(alreadyReceived)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-green-200 dark:bg-green-900 inline-block" />
                        Expected {fmt(expectedFromWSCC)}
                      </span>
                    </div>
                  </div>

                  {/* Staff cost bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500 dark:text-gray-400">
                        Staff costs
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {fmt(totalOwedStaff)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full flex rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 dark:bg-blue-600 transition-all"
                          style={{
                            width: `${totalOwedStaff > 0 ? (alreadyPaidStaff / totalOwedStaff) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-blue-200 dark:bg-blue-900 transition-all"
                          style={{
                            width: `${totalOwedStaff > 0 ? (stillOwedStaff / totalOwedStaff) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-600 inline-block" />
                        Paid {fmt(alreadyPaidStaff)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-blue-200 dark:bg-blue-900 inline-block" />
                        Still owed {fmt(stillOwedStaff)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary row */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Net position (ex-VAT)
                    </p>
                    <p
                      className={`text-lg font-semibold ${netPosition >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                    >
                      {netPosition >= 0 ? "+" : ""}
                      {fmt(netPosition)}
                    </p>
                  </div>
                  <div className="text-right">
                    {totalOwedStaff === 0 ? (
                      <span className="chip-gray">
                        No allocations this month
                      </span>
                    ) : canPayStaff ? (
                      <span className="chip-green">✓ Safe to pay staff</span>
                    ) : (
                      <span className="chip-red">
                        ⚠ Await WSCC payment first
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
