import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import MetricCard from "../components/MetricCard";
import { fmt, MONTHS_SHORT, YEARS, currentYear } from "../lib/utils";

// ── CSV helpers ──────────────────────────────────────────────────────────────
function downloadCSV(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportMonthlyPL(monthly, year) {
  const header = [
    "Month",
    "Invoiced",
    "WSCC Received",
    "Net (ex-VAT)",
    "VAT Collected",
    "Staff Costs",
    "Net Profit",
    "Margin %",
  ];
  const rows = monthly.map((m) => [
    MONTHS_SHORT[m.i],
    m.invoiced.toFixed(2),
    m.received.toFixed(2),
    m.netInv.toFixed(2),
    m.vatColl.toFixed(2),
    m.staffCost.toFixed(2),
    m.profit.toFixed(2),
    m.received > 0 ? ((m.profit / m.received) * 100).toFixed(1) + "%" : "",
  ]);
  downloadCSV(`crown-cars-pl-${year}.csv`, [header, ...rows]);
}

function exportVAT(quarters, year) {
  const header = ["Quarter", "Net (ex-VAT)", "VAT @ 20%", "Gross (inc-VAT)"];
  const rows = quarters.map((q) => [
    q.label,
    q.net.toFixed(2),
    q.vat.toFixed(2),
    q.gross.toFixed(2),
  ]);
  downloadCSV(`crown-cars-vat-${year}.csv`, [header, ...rows]);
}

function exportInvoices(invoices, year) {
  const inv = invoices.filter((x) => x.year === year);
  const header = [
    "Invoice #",
    "Route",
    "Route Name",
    "PO Number",
    "Month",
    "Year",
    "Days",
    "Unit Price",
    "Net",
    "VAT",
    "Total",
    "Paid",
    "Status",
  ];
  const rows = inv.map((x) => [
    x.invoiceNumber,
    x.routeNumber,
    x.routeName,
    x.poNumber,
    MONTHS_SHORT[x.month],
    x.year,
    x.daysWorked,
    x.unitPrice?.toFixed(2),
    x.netTotal?.toFixed(2),
    x.vat?.toFixed(2),
    x.total?.toFixed(2),
    x.paidAmount?.toFixed(2),
    x.status,
  ]);
  downloadCSV(`crown-cars-invoices-${year}.csv`, [header, ...rows]);
}

function exportStaffPayments(payments, staff, year) {
  const pays = payments.filter((p) => p.year === year);
  const getName = (p) =>
    p.isExternal
      ? p.externalName || "External"
      : staff.find((s) => s.id === p.staffId)?.name || "Unknown";
  const header = [
    "Staff",
    "Date",
    "For Month",
    "Type",
    "Reference",
    "Amount",
    "External",
  ];
  const rows = pays.map((p) => [
    getName(p),
    p.date,
    `${MONTHS_SHORT[p.month]} ${p.year}`,
    p.type,
    p.reference || "",
    p.amount.toFixed(2),
    p.isExternal ? "Yes" : "No",
  ]);
  downloadCSV(`crown-cars-staff-payments-${year}.csv`, [header, ...rows]);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Reports() {
  const { invoices, payments, staff, routes, allocations, settings } = useApp();
  const [year, setYear] = useState(() => {
    const s = localStorage.getItem("reports_year");
    return s !== null ? parseInt(s) : currentYear();
  });

  // Monthly P&L
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const inv = invoices.filter((x) => x.month === i && x.year === year);
    const pays = payments.filter((p) => p.month === i && p.year === year);
    const invoiced = inv.reduce((s, x) => s + (x.total || 0), 0);
    const netInv = inv.reduce((s, x) => s + (x.netTotal || 0), 0);
    const vatColl = inv.reduce((s, x) => s + (x.vat || 0), 0);
    const received = inv.reduce((s, x) => s + (x.paidAmount || 0), 0);
    const vatRate = settings?.vatRate || 20;
    const staffCost = pays.reduce((s, p) => s + p.amount, 0);
    const profit = received / (1 + vatRate / 100) - staffCost;
    const margin = received > 0 ? (profit / received) * 100 : null;
    return {
      i,
      invoiced,
      netInv,
      vatColl,
      received,
      staffCost,
      profit,
      margin,
    };
  });

  const totals = monthly.reduce(
    (a, m) => ({
      invoiced: a.invoiced + m.invoiced,
      netInv: a.netInv + m.netInv,
      vatColl: a.vatColl + m.vatColl,
      received: a.received + m.received,
      staffCost: a.staffCost + m.staffCost,
      profit: a.profit + m.profit,
    }),
    {
      invoiced: 0,
      netInv: 0,
      vatColl: 0,
      received: 0,
      staffCost: 0,
      profit: 0,
    },
  );
  const totMargin =
    totals.received > 0 ? (totals.profit / totals.received) * 100 : null;

  // Route P&L — uses allocations for accurate staff cost per route
  const vatRate = settings?.vatRate || 20;
  const routeReport = routes
    .map((r) => {
      const inv = invoices.filter(
        (x) => x.routeNumber === r.number && x.year === year,
      );
      const alloc = allocations.filter(
        (a) => a.routeNumber === r.number && a.year === year,
      );

      const invoiced = inv.reduce((s, x) => s + (x.total || 0), 0);
      const received = inv.reduce((s, x) => s + (x.paidAmount || 0), 0);
      const netInv = inv.reduce((s, x) => s + (x.netTotal || 0), 0);
      const totalDays = inv.reduce((s, x) => s + (x.daysWorked || 0), 0);

      // Staff cost from allocations — uses coverEntries for multiple cover drivers
      const regularCost = alloc.reduce((s, a) => s + (a.regularAmount || 0), 0);
      const tempCost = alloc.reduce((s, a) => {
        if (a.coverEntries?.length > 0)
          return (
            s +
            a.coverEntries.reduce((cs, c) => cs + (Number(c.amount) || 0), 0)
          );
        return s + (a.tempAmount || 0);
      }, 0);
      const totalStaffCost = regularCost + tempCost;

      // True profit = net received (ex-VAT) minus actual staff cost
      const netReceived = received / (1 + vatRate / 100);
      const routeProfit = netReceived - totalStaffCost;
      const margin = netReceived > 0 ? (routeProfit / netReceived) * 100 : null;

      return {
        ...r,
        invoiced,
        received,
        netInv,
        totalDays,
        invoiceCount: inv.length,
        regularCost,
        tempCost,
        totalStaffCost,
        routeProfit,
        margin,
      };
    })
    .filter((r) => r.invoiced > 0)
    .sort((a, b) => b.invoiced - a.invoiced);

  // Staff breakdown
  const staffReport = staff
    .map((s) => ({
      ...s,
      total: payments
        .filter((p) => p.staffId === s.id && p.year === year)
        .reduce((sum, p) => sum + p.amount, 0),
      count: payments.filter((p) => p.staffId === s.id && p.year === year)
        .length,
    }))
    .sort((a, b) => b.total - a.total);

  // External/one-off payments grouped by name
  const externalReport = Object.values(
    payments
      .filter((p) => p.isExternal && p.year === year && p.externalName)
      .reduce((acc, p) => {
        const key = p.externalName;
        if (!acc[key]) acc[key] = { name: key, total: 0, count: 0 };
        acc[key].total += p.amount;
        acc[key].count += 1;
        return acc;
      }, {}),
  ).sort((a, b) => b.total - a.total);

  // VAT by quarter
  const quarters = [
    { label: "Q1 (Jan–Mar)", months: [0, 1, 2] },
    { label: "Q2 (Apr–Jun)", months: [3, 4, 5] },
    { label: "Q3 (Jul–Sep)", months: [6, 7, 8] },
    { label: "Q4 (Oct–Dec)", months: [9, 10, 11] },
  ].map((q) => {
    const inv = invoices.filter(
      (x) => q.months.includes(x.month) && x.year === year,
    );
    return {
      ...q,
      net: inv.reduce((s, x) => s + (x.netTotal || 0), 0),
      vat: inv.reduce((s, x) => s + (x.vat || 0), 0),
      gross: inv.reduce((s, x) => s + (x.total || 0), 0),
    };
  });

  const pct = (n) => (n === null ? "—" : `${n.toFixed(1)}%`);
  const dash = (n) => (n === 0 ? "—" : fmt(n));

  // ── Shared classes ──
  const theadBg = "thead-row";
  const tfootBg = "tfoot-row";
  const divRow = "divide-y divide-gray-100 dark:divide-gray-700";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Reports"
        subtitle="Annual P&L, VAT summary and route profitability"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input w-28"
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(v);
                localStorage.setItem("reports_year", v);
              }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {/* Export dropdown */}
            <div className="relative group">
              <button className="btn-secondary">↓ Export CSV</button>
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg dark:shadow-black/30 py-1 hidden group-hover:block z-10">
                {[
                  {
                    label: "Monthly P&L",
                    fn: () => exportMonthlyPL(monthly, year),
                  },
                  { label: "VAT summary", fn: () => exportVAT(quarters, year) },
                  {
                    label: "All invoices",
                    fn: () => exportInvoices(invoices, year),
                  },
                  {
                    label: "Staff payments",
                    fn: () => exportStaffPayments(payments, staff, year),
                  },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
      />

      <div className="page-body">
        {/* Annual KPIs */}
        <div className="grid grid-cols-6 gap-3">
          <MetricCard
            label={`${year} invoiced`}
            value={fmt(totals.invoiced)}
            color="blue"
          />
          <MetricCard
            label="WSCC received"
            value={fmt(totals.received)}
            color="green"
          />
          <MetricCard label="Net (ex-VAT)" value={fmt(totals.netInv)} />
          <MetricCard
            label="VAT collected"
            value={fmt(totals.vatColl)}
            color="blue"
          />
          <MetricCard
            label="Staff costs"
            value={fmt(totals.staffCost)}
            color="amber"
          />
          <MetricCard
            label="Net profit"
            value={fmt(totals.profit)}
            color={totals.profit >= 0 ? "green" : "red"}
            sub={
              totMargin !== null ? `${totMargin.toFixed(1)}% margin` : undefined
            }
          />
        </div>

        {/* Monthly P&L */}
        <div className="card overflow-hidden">
          <div className="card-section flex items-center justify-between">
            <h3 className="section-title">Monthly P&L — {year}</h3>
            <button
              className="btn-ghost text-xs"
              onClick={() => exportMonthlyPL(monthly, year)}
            >
              ↓ CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className={theadBg}>
                  {[
                    "Month",
                    "Invoiced",
                    "WSCC received",
                    "Net (ex-VAT)",
                    "VAT",
                    "Staff costs",
                    "Net profit",
                    "Margin",
                  ].map((h, i) => (
                    <th key={h} className={i === 0 ? "th" : "th-r"}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={divRow}>
                {monthly.map((m) => (
                  <tr
                    key={m.i}
                    className={`tr ${m.invoiced === 0 && m.staffCost === 0 ? "opacity-30" : ""}`}
                  >
                    <td className="td font-medium">{MONTHS_SHORT[m.i]}</td>
                    <td className="td-r text-gray-600 dark:text-gray-400">
                      {dash(m.invoiced)}
                    </td>
                    <td className="td-r font-medium text-green-700 dark:text-green-400">
                      {dash(m.received)}
                    </td>
                    <td className="td-r text-gray-600 dark:text-gray-400">
                      {dash(m.netInv)}
                    </td>
                    <td className="td-r text-gray-400 dark:text-gray-500">
                      {dash(m.vatColl)}
                    </td>
                    <td className="td-r text-gray-700 dark:text-gray-300">
                      {dash(m.staffCost)}
                    </td>
                    <td
                      className={`td-r font-semibold ${m.profit > 0 ? "text-green-700 dark:text-green-400" : m.profit < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {m.received > 0 || m.staffCost > 0 ? fmt(m.profit) : "—"}
                    </td>
                    <td className="td-r text-gray-500 dark:text-gray-400">
                      {m.received > 0 ? pct(m.margin) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={tfootBg}>
                  <td className="td font-bold text-gray-900 dark:text-gray-100">
                    Total
                  </td>
                  <td className="td-r font-semibold">{fmt(totals.invoiced)}</td>
                  <td className="td-r font-semibold text-green-700 dark:text-green-400">
                    {fmt(totals.received)}
                  </td>
                  <td className="td-r font-semibold">{fmt(totals.netInv)}</td>
                  <td className="td-r font-semibold text-gray-500 dark:text-gray-400">
                    {fmt(totals.vatColl)}
                  </td>
                  <td className="td-r font-semibold">
                    {fmt(totals.staffCost)}
                  </td>
                  <td
                    className={`td-r font-bold ${totals.profit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {fmt(totals.profit)}
                  </td>
                  <td className="td-r font-semibold text-gray-600 dark:text-gray-400">
                    {pct(totMargin)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Route P&L */}
        {routeReport.length > 0 && (
          <div className="card overflow-hidden">
            <div className="card-section flex items-center justify-between">
              <h3 className="section-title">Route profitability — {year}</h3>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className={theadBg}>
                  <th className="th">Route</th>
                  <th className="th">School</th>
                  <th className="th-r">Days</th>
                  <th className="th-r">Net (ex-VAT)</th>
                  <th className="th-r">Staff cost</th>
                  <th className="th-r">Profit</th>
                  <th className="th-r">Margin</th>
                </tr>
              </thead>
              <tbody className={divRow}>
                {routeReport.map((r) => (
                  <tr key={r.id} className="tr">
                    <td className="td">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        Route {r.number}
                      </p>
                      <p className="muted">{r.name}</p>
                    </td>
                    <td className="td text-gray-500 dark:text-gray-400 text-xs">
                      {r.school || "—"}
                    </td>
                    <td className="td-r text-gray-600 dark:text-gray-400">
                      {r.totalDays}
                    </td>
                    <td className="td-r text-gray-700 dark:text-gray-300">
                      {fmt(r.netInv)}
                    </td>
                    <td className="td-r text-gray-700 dark:text-gray-300">
                      {r.totalStaffCost > 0 ? (
                        fmt(r.totalStaffCost)
                      ) : (
                        <span className="muted text-xs">No allocations</span>
                      )}
                    </td>
                    <td
                      className={`td-r font-semibold ${r.routeProfit > 0 ? "text-green-700 dark:text-green-400" : r.routeProfit < 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}
                    >
                      {r.totalStaffCost > 0 ? fmt(r.routeProfit) : "—"}
                    </td>
                    <td className="td-r text-gray-500 dark:text-gray-400">
                      {r.margin !== null && r.totalStaffCost > 0
                        ? `${r.margin.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VAT by quarter */}
        <div className="card overflow-hidden">
          <div className="card-section flex items-center justify-between">
            <div>
              <h3 className="section-title">VAT summary by quarter — {year}</h3>
              <p className="muted mt-0.5">
                Share with your accountant each quarter
              </p>
            </div>
            <button
              className="btn-ghost text-xs"
              onClick={() => exportVAT(quarters, year)}
            >
              ↓ CSV
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className={theadBg}>
                <th className="th">Quarter</th>
                <th className="th-r">Net (ex-VAT)</th>
                <th className="th-r">VAT @ 20%</th>
                <th className="th-r">Gross (inc-VAT)</th>
              </tr>
            </thead>
            <tbody className={divRow}>
              {quarters.map((q) => (
                <tr
                  key={q.label}
                  className={`tr ${q.gross === 0 ? "opacity-30" : ""}`}
                >
                  <td className="td font-medium">{q.label}</td>
                  <td className="td-r text-gray-700 dark:text-gray-300">
                    {dash(q.net)}
                  </td>
                  <td className="td-r font-medium text-blue-700 dark:text-blue-400">
                    {dash(q.vat)}
                  </td>
                  <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                    {dash(q.gross)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={tfootBg}>
                <td className="td font-bold text-gray-900 dark:text-gray-100">
                  Annual total
                </td>
                <td className="td-r font-semibold">
                  {fmt(quarters.reduce((s, q) => s + q.net, 0))}
                </td>
                <td className="td-r font-semibold text-blue-700 dark:text-blue-400">
                  {fmt(quarters.reduce((s, q) => s + q.vat, 0))}
                </td>
                <td className="td-r font-bold">
                  {fmt(quarters.reduce((s, q) => s + q.gross, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Staff breakdown */}
        {(staffReport.filter((s) => s.total > 0).length > 0 ||
          externalReport.length > 0) && (
          <div className="card overflow-hidden">
            <div className="card-section flex items-center justify-between">
              <h3 className="section-title">Staff cost breakdown — {year}</h3>
              <button
                className="btn-ghost text-xs"
                onClick={() => exportStaffPayments(payments, staff, year)}
              >
                ↓ CSV
              </button>
            </div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className={theadBg}>
                  <th className="th">Staff member</th>
                  <th className="th">Role</th>
                  <th className="th-r">Payments</th>
                  <th className="th-r">Total paid</th>
                </tr>
              </thead>
              <tbody className={divRow}>
                {staffReport
                  .filter((s) => s.total > 0)
                  .map((s) => (
                    <tr key={s.id} className="tr">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 avatar text-xs">
                            {s.name[0]}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {s.name}
                          </span>
                        </div>
                      </td>
                      <td className="td text-gray-500 dark:text-gray-400 capitalize text-xs">
                        {s.type?.replace("_", " ")}
                      </td>
                      <td className="td-r text-gray-600 dark:text-gray-400">
                        {s.count}
                      </td>
                      <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(s.total)}
                      </td>
                    </tr>
                  ))}
                {externalReport.map((e) => (
                  <tr key={e.name} className="tr">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 avatar text-xs">
                          {e.name[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {e.name}
                        </span>
                      </div>
                    </td>
                    <td className="td text-xs">
                      <span className="chip-amber">External</span>
                    </td>
                    <td className="td-r text-gray-600 dark:text-gray-400">
                      {e.count}
                    </td>
                    <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(e.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
