export const uid = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;

export const fmt = (n) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    n || 0,
  );

export const fmtD = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const YEARS = Array.from(
  { length: 8 },
  (_, i) => new Date().getFullYear() - 2 + i,
);

export const currentMonth = () => new Date().getMonth();
export const currentYear = () => new Date().getFullYear();

// Returns "March 2026" style label
export const periodLabel = (month, year) => `${MONTHS[month]} ${year}`;

// ── Route number helpers ─────────────────────────────────────────────────────
export const cleanNum = (n) =>
  String(n || "")
    .replace(/^route\s+/i, "")
    .trim();

// ── Allocation cost helpers ──────────────────────────────────────────────────
// Total cost of a single allocation across all staff
export const getAllocTotalCost = (a) => {
  const coverTotal =
    a.coverEntries?.length > 0
      ? a.coverEntries.reduce((s, c) => s + (Number(c.amount) || 0), 0)
      : Number(a.tempAmount) || 0;
  return (
    (Number(a.regularAmount) || 0) +
    coverTotal +
    (Number(a.paAmount) || 0) +
    (a.additiveEntries || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  );
};

// ── Cover PAs ────────────────────────────────────────────────────────────────
// Cover PAs are kept in allocation.coverEntries with role "pa"; anything else
// in coverEntries is a cover driver. Totals and pay treat both the same.
export const isPaCover = (c) => c?.role === "pa";

// Days each PA worked, from attendance records already filtered to one route,
// month and its run days. Split runs count 0.5 each for the AM and PM PA.
export const paDaysFromAttendance = (records = []) => {
  const byPA = {};
  const add = (id, name, days) => {
    const key = id || (name ? `name:${name.trim().toLowerCase()}` : null);
    if (!key) return;
    if (!byPA[key])
      byPA[key] = {
        staffId: id || "",
        name: name || "",
        isExternal: !id,
        days: 0,
      };
    byPA[key].days += days;
  };
  records.forEach((a) => {
    if (a.isSplitRun) {
      if (a.amPaId || a.amPaName) add(a.amPaId, a.amPaName, 0.5);
      if (a.pmPaId || a.pmPaName) add(a.pmPaId, a.pmPaName, 0.5);
      return;
    }
    const days = a.daysValue ?? 1;
    if (a.paId) add(a.paId, a.paName, days);
    else if (a.isExternalPA && a.externalPAName)
      add(null, a.externalPAName, days);
    else if (a.paName) add(null, a.paName, days);
  });
  return Object.values(byPA);
};

// Amount earned by a specific staff member from a single allocation.
// Adds up EVERY role they have on it (main driver, cover, PA, additive
// bands) — someone can be cover and also get an additive band.
export const getAllocAmountForStaff = (a, staffId) => {
  if (!staffId) return 0;
  let total = 0;
  if (a.regularStaffId === staffId) total += Number(a.regularAmount) || 0;
  if (a.coverEntries?.length > 0) {
    a.coverEntries
      .filter((c) => c.staffId === staffId)
      .forEach((c) => {
        total += Number(c.amount) || 0;
      });
  } else if (a.tempStaffId === staffId) {
    total += Number(a.tempAmount) || 0; // older allocations: single cover
  }
  if (a.paStaffId === staffId) total += Number(a.paAmount) || 0;
  (a.additiveEntries || [])
    .filter((e) => e.staffId === staffId)
    .forEach((e) => {
      total += Number(e.amount) || 0;
    });
  return Math.round(total * 100) / 100;
};

// Human-readable detail of what a staff member earned from an allocation
// (every role they had on it, joined with " + ")
export const getAllocDetailForStaff = (a, staffId) => {
  if (!staffId) return "";
  const parts = [];
  if (a.regularStaffId === staffId)
    parts.push(`${a.regularDays} days × ${fmt(a.regularRate)}`);
  if (a.coverEntries?.length > 0) {
    a.coverEntries
      .filter((c) => c.staffId === staffId)
      .forEach((e) =>
        parts.push(
          `${e.days} days × ${fmt(e.rate)} (${isPaCover(e) ? "cover PA" : "cover"})`,
        ),
      );
  } else if (a.tempStaffId === staffId) {
    parts.push(`${a.tempDays} days × ${fmt(a.tempRate)} (cover)`);
  }
  if (a.paStaffId === staffId)
    parts.push(`${a.paDays} days × ${fmt(a.paRate)} (PA)`);
  (a.additiveEntries || [])
    .filter((e) => e.staffId === staffId)
    .forEach((e) =>
      parts.push(`${e.days} days × ${fmt(e.rate)} (${e.description})`),
    );
  return parts.join(" + ");
};
