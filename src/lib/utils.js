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

// Amount earned by a specific staff member from a single allocation
export const getAllocAmountForStaff = (a, staffId) => {
  if (!staffId) return 0;
  if (a.regularStaffId === staffId) {
    let total = a.regularAmount || 0;
    (a.additiveEntries || [])
      .filter((e) => e.staffId === staffId)
      .forEach((e) => {
        total += Number(e.amount) || 0;
      });
    return total;
  }
  if (a.coverEntries?.length > 0) {
    const entry = a.coverEntries.find((c) => c.staffId === staffId);
    if (entry) return Number(entry.amount) || 0;
  }
  if (a.paStaffId === staffId) return Number(a.paAmount) || 0;
  const addE = (a.additiveEntries || []).find((e) => e.staffId === staffId);
  if (addE) return Number(addE.amount) || 0;
  return 0;
};

// Human-readable detail string for what a staff member earned from an allocation
export const getAllocDetailForStaff = (a, staffId) => {
  if (!staffId) return "";
  if (a.regularStaffId === staffId)
    return `${a.regularDays} days × ${fmt(a.regularRate)}`;
  if (a.coverEntries?.length > 0) {
    const e = a.coverEntries.find((c) => c.staffId === staffId);
    if (e) return `${e.days} days × ${fmt(e.rate)} (cover)`;
  }
  if (a.paStaffId === staffId)
    return `${a.paDays} days × ${fmt(a.paRate)} (PA)`;
  const addE = (a.additiveEntries || []).find((e) => e.staffId === staffId);
  if (addE)
    return `${addE.days} days × ${fmt(addE.rate)} (${addE.description})`;
  return "";
};
