import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import MetricCard from "../components/MetricCard";
import {
  fmt,
  MONTHS_SHORT,
  YEARS,
  currentYear,
  cleanNum,
  getAllocTotalCost,
} from "../lib/utils";

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
    `${clientLabel} Received`,
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
    m.margin !== null ? m.margin.toFixed(1) + "%" : "",
  ]);
  downloadCSV(`pl-${year}.csv`, [header, ...rows]);
}

function exportVAT(quarters, year) {
  const header = ["Quarter", "Net (ex-VAT)", "VAT @ 20%", "Gross (inc-VAT)"];
  const rows = quarters.map((q) => [
    q.label,
    q.net.toFixed(2),
    q.vat.toFixed(2),
    q.gross.toFixed(2),
  ]);
  downloadCSV(`vat-${year}.csv`, [header, ...rows]);
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
  downloadCSV(`invoices-${year}.csv`, [header, ...rows]);
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
  downloadCSV(`staff-payments-${year}.csv`, [header, ...rows]);
}

// const cleanNum = (n) =>
//   String(n || "")
//     .replace(/^route\s+/i, "")
//     .trim();

// ── Component ────────────────────────────────────────────────────────────────
export default function Reports() {
  const {
    invoices,
    payments,
    staff,
    routes,
    allocations,
    settings,
    billingRecipients,
    attendance,
    staffLicences,
    pupils,
  } = useApp();

  // ── Journey report state ──────────────────────────────────────────────────
  const [journeyRouteId, setJourneyRouteId] = useState("");
  const [journeyFrom, setJourneyFrom] = useState("");
  const [journeyTo, setJourneyTo] = useState("");
  const [journeyShowNoRun, setJourneyShowNoRun] = useState(false);
  const defaultRecipient =
    billingRecipients?.find((r) => r.isDefault) ||
    billingRecipients?.[0] ||
    null;
  const clientLabel =
    defaultRecipient?.shortName || defaultRecipient?.name || "Client";
  const [year, setYear] = useState(() => {
    const s = localStorage.getItem("reports_year");
    return s !== null ? parseInt(s) : currentYear();
  });

  // Monthly P&L
  const vatRate = settings?.vatRate || 20;
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const inv = invoices.filter((x) => x.month === i && x.year === year);
    const allocs = allocations.filter((a) => a.month === i && a.year === year);
    const invoiced = inv.reduce((s, x) => s + (x.total || 0), 0);
    const netInv = inv.reduce((s, x) => s + (x.netTotal || 0), 0);
    const vatColl = inv.reduce((s, x) => s + (x.vat || 0), 0);
    const received = inv.reduce((s, x) => s + (x.paidAmount || 0), 0);
    // Use allocations for staff cost — reflects actual cost earned that month
    // not distorted by when payments were physically transferred
    const staffCost = allocs.reduce((s, a) => s + getAllocTotalCost(a), 0);
    const netRec = received / (1 + vatRate / 100);
    const profit = netRec - staffCost;
    const margin = netRec > 0 ? (profit / netRec) * 100 : null;
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
    totals.received > 0
      ? (totals.profit / (totals.received / (1 + vatRate / 100))) * 100
      : null;

  // Route P&L — uses allocations for accurate staff cost per route

  const routeReport = routes
    .map((r) => {
      const inv = invoices.filter(
        (x) =>
          cleanNum(x.routeNumber) === cleanNum(r.number) && x.year === year,
      );
      const alloc = allocations.filter(
        (a) =>
          cleanNum(a.routeNumber) === cleanNum(r.number) && a.year === year,
      );

      const invoiced = inv.reduce((s, x) => s + (x.total || 0), 0);
      const received = inv.reduce((s, x) => s + (x.paidAmount || 0), 0);
      const netInv = inv.reduce((s, x) => s + (x.netTotal || 0), 0);
      const totalDays = inv.reduce((s, x) => s + (x.daysWorked || 0), 0);

      // Staff cost from allocations — uses coverEntries for multiple cover drivers
      const totalStaffCost = alloc.reduce(
        (s, a) => s + getAllocTotalCost(a),
        0,
      );

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

  // ── Aged debtor report ───────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const agedDebtors = invoices
    .filter((x) => (x.total || 0) - (x.paidAmount || 0) > 0.01)
    .map((x) => {
      const outstanding = (x.total || 0) - (x.paidAmount || 0);
      const invoiceDate = x.invoiceDate
        ? new Date(x.invoiceDate)
        : new Date(x.year, x.month, 1);
      const daysOld = Math.floor((today - invoiceDate) / 86400000);
      const bucket =
        daysOld <= 30
          ? "0–30"
          : daysOld <= 60
            ? "31–60"
            : daysOld <= 90
              ? "61–90"
              : "90+";
      return { ...x, outstanding, daysOld, bucket };
    })
    .sort((a, b) => b.daysOld - a.daysOld);

  const agedBuckets = ["0–30", "31–60", "61–90", "90+"].map((label) => {
    const items = agedDebtors.filter((x) => x.bucket === label);
    return {
      label,
      count: items.length,
      total: items.reduce((s, x) => s + x.outstanding, 0),
    };
  });
  const totalOutstanding = agedDebtors.reduce((s, x) => s + x.outstanding, 0);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label={`${year} invoiced`}
            value={fmt(totals.invoiced)}
            color="blue"
          />
          <MetricCard
            label={`${clientLabel} received`}
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
                    `${clientLabel} received`,
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
                        Route {cleanNum(r.number)}
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

        {/* Monthly reconciliation matrix */}
        {routeReport.length > 0 && (
          <div className="card overflow-hidden">
            <div className="card-section">
              <h3 className="section-title">Monthly reconciliation — {year}</h3>
              <p className="muted mt-0.5">
                Net profit per route per month — ex-VAT received minus all staff
                and PA costs
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className={theadBg}>
                    <th className="th">Route</th>
                    {MONTHS_SHORT.map((m) => (
                      <th key={m} className="th-r">
                        {m}
                      </th>
                    ))}
                    <th className="th-r">Total</th>
                  </tr>
                </thead>
                <tbody className={divRow}>
                  {routeReport.map((r) => {
                    const monthlyData = Array.from({ length: 12 }, (_, i) => {
                      const inv = invoices.filter(
                        (x) =>
                          cleanNum(x.routeNumber) === cleanNum(r.number) &&
                          x.month === i &&
                          x.year === year,
                      );
                      const alloc = allocations.filter(
                        (a) =>
                          cleanNum(a.routeNumber) === cleanNum(r.number) &&
                          a.month === i &&
                          a.year === year,
                      );
                      const invoiced = inv.reduce(
                        (s, x) => s + (x.total || 0),
                        0,
                      );
                      const received = inv.reduce(
                        (s, x) => s + (x.paidAmount || 0),
                        0,
                      );
                      const netReceived = received / (1 + vatRate / 100);
                      const cost = alloc.reduce((s, a) => {
                        const cover =
                          a.coverEntries?.length > 0
                            ? a.coverEntries.reduce(
                                (cs, c) => cs + (Number(c.amount) || 0),
                                0,
                              )
                            : Number(a.tempAmount) || 0;
                        return (
                          s +
                          (Number(a.regularAmount) || 0) +
                          cover +
                          (Number(a.paAmount) || 0)
                        );
                      }, 0);
                      return {
                        profit: invoiced > 0 ? netReceived - cost : null,
                        hasAlloc: alloc.length > 0,
                        invoiced,
                      };
                    });
                    const annualProfit = monthlyData
                      .filter((d) => d.profit !== null)
                      .reduce((s, d) => s + d.profit, 0);
                    return (
                      <tr key={r.id} className="tr">
                        <td className="td">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            Route {cleanNum(r.number)}
                          </p>
                          <p className="muted">{r.name}</p>
                        </td>
                        {monthlyData.map((d, i) => (
                          <td key={i} className="td-r">
                            {d.profit === null ? (
                              <span className="text-gray-200 dark:text-gray-700">
                                —
                              </span>
                            ) : !d.hasAlloc ? (
                              <span
                                className="text-amber-500 dark:text-amber-400"
                                title="No allocation — cost unknown"
                              >
                                {`£${Math.round(d.profit).toLocaleString("en-GB")}`}
                              </span>
                            ) : (
                              <span
                                className={`font-medium ${
                                  d.profit > 0
                                    ? "text-green-700 dark:text-green-400"
                                    : d.profit < 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-gray-400 dark:text-gray-500"
                                }`}
                              >
                                {`£${Math.round(d.profit).toLocaleString("en-GB")}`}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="td-r">
                          <span
                            className={`font-bold ${
                              annualProfit > 0
                                ? "text-green-700 dark:text-green-400"
                                : annualProfit < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            {`£${Math.round(annualProfit).toLocaleString("en-GB")}`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 flex gap-4 text-xs text-gray-400 dark:text-gray-500">
              <span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  Green
                </span>{" "}
                = profitable
              </span>
              <span>
                <span className="text-red-500 dark:text-red-400 font-semibold">
                  Red
                </span>{" "}
                = loss
              </span>
              <span>
                <span className="text-amber-500 dark:text-amber-400 font-semibold">
                  Amber
                </span>{" "}
                = invoice exists but no allocation recorded
              </span>
            </div>
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

        {/* Aged debtor report */}
        {agedDebtors.length > 0 && (
          <div className="card overflow-hidden">
            <div className="card-section">
              <h3 className="section-title">Aged debtor report</h3>
              <p className="muted mt-0.5">
                Outstanding invoices by age — all years
              </p>
            </div>

            {/* Summary buckets */}
            <div className="grid grid-cols-4 gap-0 border-b border-gray-100 dark:border-gray-700">
              {agedBuckets.map((b) => (
                <div
                  key={b.label}
                  className={`p-4 text-center border-r last:border-r-0 border-gray-100 dark:border-gray-700 ${
                    b.label === "90+"
                      ? "bg-red-50 dark:bg-red-900/10"
                      : b.label === "61–90"
                        ? "bg-amber-50 dark:bg-amber-900/10"
                        : ""
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                      b.label === "90+"
                        ? "text-red-600 dark:text-red-400"
                        : b.label === "61–90"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {b.label} days
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      b.label === "90+"
                        ? "text-red-700 dark:text-red-400"
                        : b.label === "61–90"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {b.total > 0 ? fmt(b.total) : "—"}
                  </p>
                  {b.count > 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {b.count} invoice{b.count !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Detail table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={theadBg}>
                    <th className="th">Invoice</th>
                    <th className="th">Route</th>
                    <th className="th-r">Invoice date</th>
                    <th className="th-r">Days old</th>
                    <th className="th-r">Total</th>
                    <th className="th-r">Paid</th>
                    <th className="th-r">Outstanding</th>
                  </tr>
                </thead>
                <tbody className={divRow}>
                  {agedDebtors.map((x) => (
                    <tr key={x.id} className="tr">
                      <td className="td">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          #{x.invoiceNumber}
                        </p>
                        <p className="muted">
                          {MONTHS_SHORT[x.month]} {x.year}
                        </p>
                      </td>
                      <td className="td">
                        <p className="text-gray-700 dark:text-gray-300">
                          Route {cleanNum(x.routeNumber)}
                        </p>
                        <p className="muted">{x.routeName}</p>
                      </td>
                      <td className="td-r text-gray-500 dark:text-gray-400">
                        {x.invoiceDate
                          ? new Date(x.invoiceDate).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="td-r">
                        <span
                          className={`font-semibold ${
                            x.daysOld > 90
                              ? "text-red-600 dark:text-red-400"
                              : x.daysOld > 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {x.daysOld}d
                        </span>
                      </td>
                      <td className="td-r text-gray-600 dark:text-gray-400">
                        {fmt(x.total)}
                      </td>
                      <td className="td-r text-gray-500 dark:text-gray-400">
                        {x.paidAmount > 0 ? fmt(x.paidAmount) : "—"}
                      </td>
                      <td className="td-r font-semibold text-red-600 dark:text-red-400">
                        {fmt(x.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={tfootBg}>
                    <td
                      className="td font-bold text-gray-900 dark:text-gray-100"
                      colSpan={6}
                    >
                      Total outstanding
                    </td>
                    <td className="td-r font-bold text-red-600 dark:text-red-400">
                      {fmt(totalOutstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Journey records */}
        <div className="card overflow-hidden">
          <div className="card-section">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="section-title">Journey records</h3>
                <p className="muted mt-0.5">
                  One row per passenger per journey direction — AM and PM
                  separate. For authority inquiries.
                </p>
              </div>
              {(() => {
                if (!journeyRouteId && !journeyFrom && !journeyTo) return null;
                const filteredAtt = attendance
                  .filter((a) => {
                    if (journeyRouteId && a.routeId !== journeyRouteId)
                      return false;
                    if (journeyFrom && a.date < journeyFrom) return false;
                    if (journeyTo && a.date > journeyTo) return false;
                    if (!journeyShowNoRun && a.status === "no_run")
                      return false;
                    return true;
                  })
                  .sort((a, b) => a.date.localeCompare(b.date));
                if (filteredAtt.length === 0) return null;

                // Build CSV rows — one per pupil per direction
                const header = [
                  "Date",
                  "Direction",
                  "Route",
                  "School",
                  "Driver",
                  "Vehicle Reg",
                  "Driver Licence",
                  "PA",
                  "Passenger",
                  "Pickup Address",
                  "Pickup Time",
                  "Dropoff Address",
                  "Status",
                  "Notes",
                ];
                const csvRows = [];
                filteredAtt.forEach((a) => {
                  const route = routes.find((r) => r.id === a.routeId);
                  const schoolAddr = route?.school || "";
                  const routePupils = pupils.filter(
                    (p) => p.routeId === a.routeId && p.status === "active",
                  );
                  const presentPupils =
                    a.childrenAttendance?.length > 0
                      ? routePupils.filter((p) =>
                          a.childrenAttendance.find(
                            (c) => c.childId === p.id && c.attended !== false,
                          ),
                        )
                      : routePupils;

                  const amDriverId = a.isSplitRun ? a.amDriverId : a.driverId;
                  const amDriverName = a.isSplitRun
                    ? a.amDriverName || ""
                    : a.isExternalDriver
                      ? a.externalDriverName
                      : a.driverName || "";
                  const pmDriverId = a.isSplitRun ? a.pmDriverId : a.driverId;
                  const pmDriverName = a.isSplitRun
                    ? a.pmDriverName || ""
                    : a.isExternalDriver
                      ? a.externalDriverName
                      : a.driverName || "";
                  const amLic = staffLicences.find(
                    (l) => l.staffId === amDriverId,
                  );
                  const pmLic = staffLicences.find(
                    (l) => l.staffId === pmDriverId,
                  );
                  const paName = a.isExternalPA
                    ? `${a.externalPAName} (ext)`
                    : a.paName || "";
                  const statusLabel =
                    a.status === "no_run"
                      ? `No run${a.noRunReason ? ` — ${a.noRunReason.replace(/_/g, " ")}` : ""}`
                      : a.status === "half_day"
                        ? "Half day"
                        : "Completed";

                  presentPupils.forEach((p) => {
                    const homeAddr = p.pickupAddresses?.[0]?.address || "";
                    // AM row
                    csvRows.push([
                      a.date,
                      "AM",
                      `Route ${a.routeNumber}`,
                      schoolAddr,
                      amDriverName,
                      amLic?.vehicleRegistration || "",
                      amLic?.driverLicenceNumber || "",
                      paName,
                      `${p.firstName} ${p.lastName}`,
                      homeAddr,
                      p.amPickupTime || "",
                      schoolAddr,
                      statusLabel,
                      a.notes || "",
                    ]);
                    // PM row
                    csvRows.push([
                      a.date,
                      "PM",
                      `Route ${a.routeNumber}`,
                      schoolAddr,
                      pmDriverName,
                      pmLic?.vehicleRegistration || "",
                      pmLic?.driverLicenceNumber || "",
                      paName,
                      `${p.firstName} ${p.lastName}`,
                      schoolAddr,
                      p.pmPickupTime || "",
                      homeAddr,
                      statusLabel,
                      a.notes || "",
                    ]);
                  });
                });

                const routeNum = routes.find(
                  (r) => r.id === journeyRouteId,
                )?.number;
                return (
                  <button
                    className="btn-ghost text-xs flex-shrink-0"
                    onClick={() =>
                      downloadCSV(
                        `journey-records${routeNum ? `-route-${routeNum}` : ""}${journeyFrom ? `-from-${journeyFrom}` : ""}${journeyTo ? `-to-${journeyTo}` : ""}.csv`,
                        [header, ...csvRows],
                      )
                    }
                  >
                    ↓ CSV
                  </button>
                );
              })()}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mt-4 flex-wrap items-center">
              <select
                className="input w-56"
                value={journeyRouteId}
                onChange={(e) => setJourneyRouteId(e.target.value)}
              >
                <option value="">All routes</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    Route {r.number} — {r.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  From
                </label>
                <input
                  className="input w-36"
                  type="date"
                  value={journeyFrom}
                  onChange={(e) => setJourneyFrom(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  To
                </label>
                <input
                  className="input w-36"
                  type="date"
                  value={journeyTo}
                  onChange={(e) => setJourneyTo(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={journeyShowNoRun}
                  onChange={(e) => setJourneyShowNoRun(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Include no-run days
              </label>
              {(journeyRouteId || journeyFrom || journeyTo) && (
                <button
                  className="btn-ghost text-xs text-gray-400"
                  onClick={() => {
                    setJourneyRouteId("");
                    setJourneyFrom("");
                    setJourneyTo("");
                    setJourneyShowNoRun(false);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {(() => {
            if (!journeyRouteId && !journeyFrom && !journeyTo) {
              return (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  Select a route or date range above to view journey records.
                </div>
              );
            }

            const filteredAtt = attendance
              .filter((a) => {
                if (journeyRouteId && a.routeId !== journeyRouteId)
                  return false;
                if (journeyFrom && a.date < journeyFrom) return false;
                if (journeyTo && a.date > journeyTo) return false;
                if (!journeyShowNoRun && a.status === "no_run") return false;
                return true;
              })
              .sort((a, b) => a.date.localeCompare(b.date));

            const totalInPeriod = attendance.filter((a) => {
              if (journeyRouteId && a.routeId !== journeyRouteId) return false;
              if (journeyFrom && a.date < journeyFrom) return false;
              if (journeyTo && a.date > journeyTo) return false;
              return true;
            }).length;
            if (filteredAtt.length === 0) {
              return (
                <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  {totalInPeriod > 0
                    ? `${totalInPeriod} attendance record${totalInPeriod !== 1 ? "s" : ""} found but all are no-run days — tick "Include no-run days" to see them.`
                    : "No attendance records found for this period. Fill in the Attendance Register first."}
                </div>
              );
            }

            // Build display rows — one per pupil per direction
            const displayRows = [];
            filteredAtt.forEach((a) => {
              const route = routes.find((r) => r.id === a.routeId);
              const schoolAddr = route?.school || "—";
              const routePupils = pupils.filter(
                (p) => p.routeId === a.routeId && p.status === "active",
              );
              const presentPupils =
                a.childrenAttendance?.length > 0
                  ? routePupils.filter((p) =>
                      a.childrenAttendance.find(
                        (c) => c.childId === p.id && c.attended !== false,
                      ),
                    )
                  : routePupils;

              const amDriverId = a.isSplitRun ? a.amDriverId : a.driverId;
              const amDriverName = a.isSplitRun
                ? a.amDriverName || "—"
                : a.isExternalDriver
                  ? `${a.externalDriverName} (ext)`
                  : a.driverName || "—";
              const pmDriverId = a.isSplitRun ? a.pmDriverId : a.driverId;
              const pmDriverName = a.isSplitRun
                ? a.pmDriverName || "—"
                : a.isExternalDriver
                  ? `${a.externalDriverName} (ext)`
                  : a.driverName || "—";
              const amLic = staffLicences.find((l) => l.staffId === amDriverId);
              const pmLic = staffLicences.find((l) => l.staffId === pmDriverId);
              const paDisplay = a.isExternalPA
                ? `${a.externalPAName} (ext)`
                : a.paName || "—";
              const isNoRun = a.status === "no_run";
              const statusLabel = isNoRun
                ? `No run${a.noRunReason ? ` — ${a.noRunReason.replace(/_/g, " ")}` : ""}`
                : a.status === "half_day"
                  ? "Half day"
                  : "Completed";
              const dateLabel = new Date(
                a.date.replace(/-/g, "/"),
              ).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              if (presentPupils.length === 0) {
                // No pupils recorded — still show the journey with blank passenger
                ["AM", "PM"].forEach((dir) => {
                  const driverName = dir === "AM" ? amDriverName : pmDriverName;
                  const lic = dir === "AM" ? amLic : pmLic;
                  displayRows.push({
                    key: `${a.id}_${dir}_nopupil`,
                    date: dateLabel,
                    direction: dir,
                    routeNumber: a.routeNumber,
                    routeName: route?.name,
                    driver: driverName,
                    vehicleReg: lic?.vehicleRegistration || "—",
                    licNum: lic?.driverLicenceNumber || "—",
                    pa: paDisplay,
                    passenger: "—",
                    pickupAddr: dir === "AM" ? "—" : schoolAddr,
                    pickupTime: "—",
                    dropoffAddr: dir === "AM" ? schoolAddr : "—",
                    status: statusLabel,
                    isNoRun,
                    notes: a.notes || "—",
                  });
                });
              } else {
                presentPupils.forEach((p) => {
                  const homeAddr = p.pickupAddresses?.[0]?.address || "—";
                  ["AM", "PM"].forEach((dir) => {
                    const driverName =
                      dir === "AM" ? amDriverName : pmDriverName;
                    const lic = dir === "AM" ? amLic : pmLic;
                    displayRows.push({
                      key: `${a.id}_${dir}_${p.id}`,
                      date: dateLabel,
                      direction: dir,
                      routeNumber: a.routeNumber,
                      routeName: route?.name,
                      driver: driverName,
                      vehicleReg: lic?.vehicleRegistration || "—",
                      licNum: lic?.driverLicenceNumber || "—",
                      pa: paDisplay,
                      passenger: `${p.firstName} ${p.lastName}`,
                      pickupAddr: dir === "AM" ? homeAddr : schoolAddr,
                      pickupTime:
                        dir === "AM"
                          ? p.amPickupTime || "—"
                          : p.pmPickupTime || "—",
                      dropoffAddr: dir === "AM" ? schoolAddr : homeAddr,
                      status: statusLabel,
                      isNoRun,
                      notes: a.notes || "—",
                    });
                  });
                });
              }
            });

            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={theadBg}>
                      <th className="th">Date</th>
                      <th className="th">Dir</th>
                      <th className="th">Route</th>
                      <th className="th">Driver</th>
                      <th className="th">Vehicle</th>
                      <th className="th">PA</th>
                      <th className="th">Passenger</th>
                      <th className="th">Pickup address</th>
                      <th className="th">Pickup time</th>
                      <th className="th">Dropoff address</th>
                      <th className="th">Status</th>
                      <th className="th">Notes</th>
                    </tr>
                  </thead>
                  <tbody className={divRow}>
                    {displayRows.map((row) => (
                      <tr
                        key={row.key}
                        className={`tr ${row.isNoRun ? "opacity-50" : ""}`}
                      >
                        <td className="td whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                          {row.date}
                        </td>
                        <td className="td">
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              row.direction === "AM"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {row.direction}
                          </span>
                        </td>
                        <td className="td">
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs">
                            Route {row.routeNumber}
                          </p>
                          <p className="muted text-[10px]">{row.routeName}</p>
                        </td>
                        <td className="td">
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {row.driver}
                          </p>
                          {row.licNum !== "—" && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              {row.vehicleReg}
                            </p>
                          )}
                        </td>
                        <td className="td font-mono text-xs text-gray-600 dark:text-gray-400">
                          {row.vehicleReg}
                        </td>
                        <td className="td text-xs text-gray-500 dark:text-gray-400">
                          {row.pa}
                        </td>
                        <td className="td text-xs font-medium text-gray-700 dark:text-gray-300">
                          {row.passenger}
                        </td>
                        <td className="td text-xs text-gray-500 dark:text-gray-400 max-w-[140px]">
                          {row.pickupAddr}
                        </td>
                        <td className="td text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {row.pickupTime}
                        </td>
                        <td className="td text-xs text-gray-500 dark:text-gray-400 max-w-[140px]">
                          {row.dropoffAddr}
                        </td>
                        <td
                          className={`td text-xs font-semibold whitespace-nowrap ${
                            row.isNoRun
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-700 dark:text-green-400"
                          }`}
                        >
                          {row.status}
                        </td>
                        <td className="td text-xs text-gray-400 dark:text-gray-500">
                          {row.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={tfootBg}>
                      <td
                        className="td font-bold text-gray-900 dark:text-gray-100"
                        colSpan={2}
                      >
                        {displayRows.length} record
                        {displayRows.length !== 1 ? "s" : ""}
                      </td>
                      <td
                        className="td text-gray-500 dark:text-gray-400"
                        colSpan={10}
                      >
                        {filteredAtt.filter((a) => a.status === "ran").length}{" "}
                        days ran ·{" "}
                        {
                          filteredAtt.filter((a) => a.status === "no_run")
                            .length
                        }{" "}
                        no-run ·{" "}
                        {
                          displayRows.filter(
                            (r) => r.direction === "AM" && !r.isNoRun,
                          ).length
                        }{" "}
                        AM journeys ·{" "}
                        {
                          displayRows.filter(
                            (r) => r.direction === "PM" && !r.isNoRun,
                          ).length
                        }{" "}
                        PM journeys
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })()}
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
