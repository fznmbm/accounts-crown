import { MONTHS } from "./utils";

const fmt = (n) =>
  `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function generateInvoicePDF({
  invoiceNumber,
  route,
  settings,
  daysWorked,
  invoiceDate,
  month,
  year,
  bands,
}) {
  const vatRate = Number(settings?.vatRate || 20);
  const address = (
    settings.address || "1, John Brackpool Close, Crawley, RH10 8FA"
  ).replace(/\n/g, ", ");

  // If route has rate bands and caller passed band days, use bands — otherwise single rate
  const usesBands =
    bands && Object.keys(bands).length > 0 && route.rateBands?.length > 0;

  const lines = usesBands
    ? route.rateBands
        .filter((b) => bands[b.id] && Number(bands[b.id]) > 0)
        .map((b) => ({
          description: `Route ${route.number} ${route.name} — ${b.description}`,
          qty: Number(bands[b.id]),
          unitPrice: Number(b.wsccRate),
          amount:
            Math.round(Number(bands[b.id]) * Number(b.wsccRate) * 100) / 100,
        }))
    : [
        {
          description: `Route ${route.number} ${route.name}`,
          qty: Number(daysWorked),
          unitPrice: Number(route.dailyRate),
          amount:
            Math.round(Number(daysWorked) * Number(route.dailyRate) * 100) /
            100,
        },
      ];

  const netTotal =
    Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const vat = Math.round(netTotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((netTotal + vat) * 100) / 100;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice ${invoiceNumber}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
.bar { background: #1d4ed8; color: white; padding: 10px 20px; display: flex; align-items: center; gap: 12px; }
.bar button { background: white; color: #1d4ed8; border: none; padding: 7px 18px; border-radius: 4px; cursor: pointer; font-weight: bold; }
.bar small { margin-left: auto; opacity: 0.75; }
.page { padding: 22mm 20mm; width: 210mm; margin: 0 auto; }
.top { display: flex; justify-content: space-between; margin-bottom: 22px; }
.top p { line-height: 1.75; }
.invoice-title { font-size: 34pt; font-weight: bold; color: #999; letter-spacing: 3px; margin-top: 4px; }
.meta p { line-height: 2; }
table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
thead th { background: #f0f0f0; border: 1px solid #bbb; padding: 6px 10px; text-align: left; font-size: 9.5pt; }
tbody td { border: 1px solid #bbb; padding: 6px 10px; }
.r { text-align: right; }
.c { text-align: center; }
.totals td { padding: 4px 10px; border: none; }
.totals td:first-child { width: 65%; }
.totals td:last-child { text-align: right; font-weight: 500; }
.total-final td { font-weight: bold; border-top: 1.5px solid #000; padding-top: 7px; }
.footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #ccc; line-height: 2.1; font-size: 9.5pt; }
@media print { .bar { display: none !important; } }
</style>
</head>
<body>
<div class="bar">
  <span>Invoice ${invoiceNumber} — ${MONTHS[month]} ${year}</span>
  <button onclick="window.print()">Save as PDF</button>
  <small>In the print dialog, set destination to "Save as PDF"</small>
</div>
<div class="page">
  <div class="top">
    <div>
      <p style="margin-bottom:14px"><strong>Date</strong></p>
      <p>To :West Sussex County Council &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${invoiceDate}</p>
      <p>County Hall</p>
      <p>West Street</p>
      <p>Chichester</p>
      <p>PO19 1RQ</p>
      <br/>
      <p>From : ${settings.companyName || "Crown Cars Ltd"}</p>
      <p>${address}</p>
      <p>Phone- ${settings.phone || ""}</p>
      <p>Email- ${settings.email || ""}</p>
    </div>
    <div class="invoice-title">INVOICE</div>
  </div>

  <div class="meta" style="margin-bottom:18px">
    <p><strong>Invoice Number</strong> &nbsp; ${invoiceNumber}</p>
    <p><strong>Vendor Number</strong> &nbsp; ${settings.supplierNumber || "103820"}</p>
    <p><strong>Purchase Order Number</strong> &nbsp; ${route.poNumber || ""}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="c">Quantity</th>
        <th class="c">Unit Price</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
<tbody>
      ${lines
        .map(
          (l) => `
      <tr>
        <td>${l.description}</td>
        <td class="c">${l.qty}</td>
        <td class="c">${l.unitPrice.toFixed(2)}</td>
        <td class="r">${fmt(l.amount)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <table class="totals" style="margin-top:4px">
    <tbody>
      <tr><td>Net Total</td><td>${fmt(netTotal)}</td></tr>
      <tr><td>VAT</td><td>${fmt(vat)}</td></tr>
      <tr class="total-final"><td>Total</td><td>${fmt(total)}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Payment Method &nbsp;-</p>
    <p>Vat registration number &nbsp;- &nbsp;${settings.vatNumber || ""}</p>
    <p>Name &nbsp;${settings.accountName || settings.companyName || "Crown Cars Ltd"}</p>
    <p>AC No &nbsp;${settings.accountNo || ""}</p>
    <p>Sort Code &nbsp;${settings.sortCode || ""}</p>
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1000,height=820");
  if (win) {
    win.document.write(html);
    win.document.close();
  } else
    alert(
      "Pop-up blocked — please allow pop-ups for this site to generate invoices.",
    );
}
