import jsPDF from "jspdf";
import { cleanNum } from "./utils";

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmtPDF = (n) =>
  `£${Number(n).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Page constants (A4, mm) ───────────────────────────────────────────────────
const M = 20; // margin
const PW = 210; // page width
const CW = PW - M * 2; // content width 170mm

// Column x positions
const COL_QTY_X = M + 95;
const COL_UNIT_X = M + 120;
const COL_AMT_X = PW - M;

// Right-aligned text helper
function rText(doc, text, x, y) {
  const w = doc.getTextWidth(String(text));
  doc.text(String(text), x - w, y);
}

// ── Line builder (mirrors invoiceGenerator.js logic) ─────────────────────────
function buildLines({ route, bands, notes, standardDays, daysWorked }) {
  const rNum = cleanNum(route.number);
  const usesBands =
    bands && Object.keys(bands).length > 0 && route.rateBands?.length > 0;

  let lines = [];

  if (!usesBands) {
    lines = [
      {
        description: `Route ${rNum} ${route.name}${notes ? ` — ${notes}` : ""}`,
        qty: Number(daysWorked),
        unitPrice: Number(route.dailyRate),
        amount:
          Math.round(Number(daysWorked) * Number(route.dailyRate) * 100) / 100,
      },
    ];
  } else {
    const allAdditive = route.rateBands.every((b) => b.isAdditive);
    const datedBand = route.rateBands.find(
      (b) => !b.isAdditive && b.effectiveFrom,
    );
    const hasDatedReplacement = !!datedBand;

    const stdLabel = hasDatedReplacement
      ? `Route ${rNum} ${route.name} — Before ${new Date(
          datedBand.effectiveFrom,
        ).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
      : `Route ${rNum} ${route.name} — Standard run${notes ? ` — ${notes}` : ""}`;

    const hasReplacementBand = route.rateBands.some((b) => !b.isAdditive);
    lines = [
      ...((allAdditive || hasReplacementBand) && standardDays > 0
        ? [
            {
              description: stdLabel,
              qty: standardDays,
              unitPrice: Number(route.dailyRate),
              amount:
                Math.round(standardDays * Number(route.dailyRate) * 100) / 100,
            },
          ]
        : []),
      ...route.rateBands
        .filter((b) => bands[b.id] && Number(bands[b.id]) > 0)
        .map((b) => ({
          description:
            b.effectiveFrom && !b.isAdditive
              ? `From ${new Date(b.effectiveFrom).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })} — ${b.description}`
              : b.description,
          qty: Number(bands[b.id]),
          unitPrice: Number(b.wsccRate),
          amount:
            Math.round(Number(bands[b.id]) * Number(b.wsccRate) * 100) / 100,
        })),
    ];
  }

  // PA line — add when route has a PA assigned with a WSCC rate
  const totalQty =
    Number(daysWorked) > 0 ? Number(daysWorked) : Number(standardDays);
  if (route.primaryPAId && Number(route.paDailyRate || 0) > 0 && totalQty > 0) {
    lines.push({
      description: "PA",
      qty: totalQty,
      unitPrice: Number(route.paDailyRate),
      amount: Math.round(totalQty * Number(route.paDailyRate) * 100) / 100,
    });
  }

  return lines;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function generateInvoicePDFBlob({
  invoiceNumber,
  route,
  settings,
  daysWorked,
  invoiceDate,
  month,
  year,
  bands = {},
  notes = "",
  standardDays = 0,
  recipient = null,
}) {
  const vatRate = Number(settings?.vatRate || 20);
  const addressParts = (settings?.address || "")
    .split(/\n|,\s*/)
    .filter(Boolean);

  const lines = buildLines({ route, bands, notes, standardDays, daysWorked });
  const netTotal =
    Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const vat = Math.round(netTotal * (vatRate / 100) * 100) / 100;
  const total = Math.round((netTotal + vat) * 100) / 100;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  // ── "INVOICE" title ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(170, 170, 170);
  rText(doc, "INVOICE", PW - M, y + 8);
  doc.setTextColor(0, 0, 0);

  // ── Date label ────────────────────────────────────────────────────────────
  // ── Date + To / From address ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Date:", M, y + 2);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceDate, M + 16, y + 2);
  y += 8;

  const recipientName = recipient?.name || "";
  const recipientAddressLines = (recipient?.address || "")
    .split("\n")
    .filter(Boolean);

  doc.setFont("helvetica", "bold");
  doc.text("To: ", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(recipientName, M + doc.getTextWidth("To: "), y);
  y += 5;
  recipientAddressLines.forEach((line) => {
    doc.text(line, M, y);
    y += 5;
  });

  y += 3;

  doc.setFont("helvetica", "bold");
  doc.text("From: ", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(settings?.companyName || "", M + doc.getTextWidth("From: "), y);
  y += 5;
  [
    ...addressParts,
    settings?.phone ? `Phone: ${settings.phone}` : null,
    settings?.email ? `Email: ${settings.email}` : null,
  ]
    .filter(Boolean)
    .forEach((line) => {
      doc.text(line, M, y);
      y += 5;
    });

  y += 5;

  // ── Meta block ────────────────────────────────────────────────────────────
  [
    ["Invoice Number", String(invoiceNumber)],
    ["Vendor Number", recipient?.supplierRef || settings?.supplierNumber || ""],
    ["Purchase Order Number", route.poNumber || "—"],
  ].forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, M + 60, y);
    y += 6;
  });

  y += 4;

  // ── Table ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  const rowH = 8;
  const tableStartY = y;

  // Vertical separator x positions
  const SEP1 = M + 85; // Description | Qty
  const SEP2 = M + 107; // Qty | Unit Price
  const SEP3 = M + 135; // Unit Price | Amount (55mm column)

  // Header row
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y, CW, rowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", M + 2, y + 5.5);
  doc.text("Qty", COL_QTY_X, y + 5.5, { align: "center" });
  doc.text("Unit Price", COL_UNIT_X, y + 5.5, { align: "center" });
  rText(doc, "Amount", COL_AMT_X - 2, y + 5.5);
  y += rowH;

  // Data rows
  doc.setFont("helvetica", "normal");
  lines.forEach((l) => {
    doc.rect(M, y, CW, rowH, "D");
    const desc =
      l.description.length > 55
        ? l.description.substring(0, 53) + "…"
        : l.description;
    doc.text(desc, M + 2, y + 5.5);
    doc.text(String(l.qty), COL_QTY_X, y + 5.5, { align: "center" });
    doc.text(l.unitPrice.toFixed(2), COL_UNIT_X, y + 5.5, { align: "center" });
    rText(doc, fmtPDF(l.amount), COL_AMT_X - 2, y + 5.5);
    y += rowH;
  });

  // Vertical column separators spanning full table height
  const tableEndY = y;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  [SEP1, SEP2, SEP3].forEach((x) => {
    doc.line(x, tableStartY, x, tableEndY);
  });

  y += 3;

  // ── Totals — proper table rows matching the grid above ───────────────────
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  const rowHT = 8;
  const totalsLeft = SEP2;
  const totalsCW = PW - M - totalsLeft;

  // Net Total row
  doc.setFont("helvetica", "normal");
  doc.rect(totalsLeft, y, totalsCW, rowHT, "D");
  doc.line(SEP3, y, SEP3, y + rowHT);
  doc.text("Net Total", totalsLeft + 3, y + 5.5);
  rText(doc, fmtPDF(netTotal), COL_AMT_X - 2, y + 5.5);
  y += rowHT;

  // VAT row
  doc.rect(totalsLeft, y, totalsCW, rowHT, "D");
  doc.line(SEP3, y, SEP3, y + rowHT);
  doc.text("VAT", totalsLeft + 3, y + 5.5);
  rText(doc, fmtPDF(vat), COL_AMT_X - 2, y + 5.5);
  y += rowHT;

  // Total row — shaded to match header
  doc.setFillColor(240, 240, 240);
  doc.rect(totalsLeft, y, totalsCW, rowHT, "FD");
  doc.line(SEP3, y, SEP3, y + rowHT);
  doc.setFont("helvetica", "bold");
  doc.text("Total", totalsLeft + 3, y + 5.5);
  rText(doc, fmtPDF(total), COL_AMT_X - 2, y + 5.5);
  y += rowHT + 8;

  y += 4;

  // ── Footer ────────────────────────────────────────────────────────────────
  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setLineWidth(0.3);
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, PW - M, y);
  y += 6;

  const footerRows = [
    ["Payment Method", "—"],
    ["VAT Registration No.", settings?.vatNumber || ""],
    ["Name", settings?.accountName || settings?.companyName || ""],
    ["Account No.", settings?.accountNo || ""],
    ["Sort Code", settings?.sortCode || ""],
  ];
  const footerBoxH = footerRows.length * 7 + 6;
  const footerBoxW = 112;

  doc.setFillColor(248, 248, 248);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(M, y, footerBoxW, footerBoxH, "FD");

  y += 5;
  doc.setFontSize(9);
  footerRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M + 3, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "—"), M + 50, y);
    y += 7;
  });

  return doc.output("blob");
}
