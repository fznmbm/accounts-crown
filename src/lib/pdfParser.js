import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker – reliable across Vite setups
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

async function extractText(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let txt = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const ct = await pg.getTextContent();
    txt += ct.items.map((x) => x.str).join(" ") + "\n";
  }
  return txt;
}

/**
 * Parse a Crown Cars invoice PDF.
 * Returns structured invoice data ready to save.
 */
export async function parseInvoicePDF(file) {
  const txt = await extractText(file);

  // Core identifiers
  const invoiceNumber = txt.match(/Invoice Number\s+(\d+)/i)?.[1]?.trim() || "";
  const poNumber =
    txt.match(/Purchase Order Number\s+([\w\d]+)/i)?.[1]?.trim() || "";

  // Date: DD/MM/YYYY → ISO
  const dateStr = txt.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] || "";
  let invoiceDate = null;
  let month = new Date().getMonth();
  let year = new Date().getFullYear();
  if (dateStr) {
    const [d, m, y] = dateStr.split("/");
    invoiceDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    month = parseInt(m) - 1;
    year = parseInt(y);
  }

  // Route line: "Route 50540 Philpots taxi 22 116.88 £2,571.36"
  // Non-greedy name capture stops at qty + unit price
  const routeLine = txt.match(
    /Route\s+([A-Za-z0-9]+)\s+(.*?)\s+(\d+)\s+([\d.]+)\s+£([\d,]+\.\d{2})/,
  );
  const routeNumber = routeLine?.[1] || "";
  const routeName = routeLine?.[2]?.trim() || "";
  const daysWorked = routeLine ? parseInt(routeLine[3]) : 0;
  const unitPrice = routeLine ? parseFloat(routeLine[4]) : 0;
  const lineAmount = routeLine ? parseFloat(routeLine[5].replace(/,/g, "")) : 0;

  // Net total
  const netTotal = parseFloat(
    txt.match(/Net Total\s+£([\d,]+\.\d{2})/i)?.[1]?.replace(/,/g, "") ||
      lineAmount,
  );

  // VAT
  const vat = parseFloat(
    txt.match(/\bVAT\s+£([\d,]+\.\d{2})/)?.[1]?.replace(/,/g, "") || "0",
  );

  // Final total: last "Total £..." in doc (skips "Net Total")
  const allTotals = [...txt.matchAll(/\bTotal\s+£([\d,]+\.\d{2})/g)];
  const total =
    allTotals.length > 0
      ? parseFloat(allTotals[allTotals.length - 1][1].replace(/,/g, ""))
      : netTotal + vat;

  return {
    invoiceNumber,
    poNumber,
    invoiceDate,
    month,
    year,
    routeNumber,
    routeName,
    daysWorked,
    unitPrice,
    netTotal,
    vat,
    total,
    status: "unpaid",
    paidAmount: 0,
    fileName: file.name,
  };
}

/**
 * Parse a WSCC remittance advice PDF.
 */
export async function parseRemittancePDF(file) {
  const txt = await extractText(file);

  // Extract invoice number + amount pairs
  const items = [];
  const re = /\b(\d{4,5})\b\s+£([\d,]+\.\d{2})/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const n = m[1];
    const a = parseFloat(m[2].replace(/,/g, ""));
    if (parseInt(n) > 999 && parseInt(n) < 99999 && a > 0 && a < 100000) {
      items.push({ invoiceNumber: n, amount: a });
    }
  }
  const seen = new Set();
  const unique = items.filter(
    (x) => !seen.has(x.invoiceNumber) && seen.add(x.invoiceNumber),
  );

  const totalMatch = txt.match(/Payment Total\s+£([\d,]+\.\d{2})/);
  const total = totalMatch
    ? parseFloat(totalMatch[1].replace(/,/g, ""))
    : unique.reduce((s, x) => s + x.amount, 0);

  const paymentNumber = txt.match(/Payment Number\s*[:\-]\s*(\d+)/i)?.[1] || "";

  // Payment date = remittance date + 2 bank working days
  const dm = txt.match(/(\d{2}\/\d{2}\/\d{4})/);
  let paymentDate = new Date().toISOString().split("T")[0];
  if (dm?.[1]) {
    const [d, mo, y] = dm[1].split("/");
    const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
    // Add 2 bank working days — skip weekends
    let daysAdded = 0;
    while (daysAdded < 2) {
      dt.setDate(dt.getDate() + 1);
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) daysAdded++; // skip Sat(6) and Sun(0)
    }
    paymentDate = dt.toISOString().split("T")[0];
  }

  return {
    items: unique,
    total,
    paymentNumber,
    paymentDate,
    fileName: file.name,
  };
}
