// ── Month-end status calculations ───────────────────────────────────────────
// Pure functions: no React, no database. Shared by Invoice Submissions,
// Month Close and the Dashboard, so every screen agrees on the numbers.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n) => Number(n) || 0;

// Submission statuses that count as "we have their invoice"
export const RECEIVED_STATUSES = ["submitted", "approved", "office_recorded"];

// Which submission wins when a person has more than one for the month
const STATUS_RANK = {
  approved: 5,
  submitted: 4,
  office_recorded: 3,
  recalled: 2,
  rejected: 1,
};

// Category order: a person who is regular on one route and cover on another
// counts as regular (must submit)
const CATEGORY_RANK = { regular: 3, cover: 2, external: 1 };

// ── Earnings per person from allocations ────────────────────────────────────
// One entry per person (staff list by id, external temps by name), with a
// line per route and role. `include(a)` picks which allocations count.
function collectEarnings(allocations, staffById, include = () => true) {
  const people = new Map();

  const add = ({
    staffId,
    name,
    category,
    routeLabel,
    role,
    days,
    amount,
    month,
    year,
  }) => {
    amount = round2(amount);
    if (amount <= 0) return;
    if (!staffId && !name) return;
    const key = personKey(staffId, name);
    let p = people.get(key);
    if (!p) {
      const s = staffId ? staffById.get(staffId) : null;
      p = {
        key,
        staffId: staffId || null,
        name: s?.name || name || "Unknown",
        phone: s?.phone || "",
        staffType: s?.type || "",
        category,
        lines: [],
        expectedAmount: 0,
      };
      people.set(key, p);
    }
    if (CATEGORY_RANK[category] > CATEGORY_RANK[p.category])
      p.category = category;
    p.lines.push({ routeLabel, role, days: num(days), amount, month, year });
    p.expectedAmount = round2(p.expectedAmount + amount);
  };

  allocations.filter(include).forEach((a) => {
    const routeLabel = a.routeNumber || a.routeName || "";
    const month = Number(a.month);
    const year = Number(a.year);

    // Main driver (+ any additive bands paid to them)
    if (a.regularStaffId) {
      const additive = (a.additiveEntries || [])
        .filter((e) => e.staffId === a.regularStaffId)
        .reduce((s, e) => s + num(e.amount), 0);
      add({
        staffId: a.regularStaffId,
        category: "regular",
        routeLabel,
        role: "Driver",
        days: a.regularDays,
        amount: num(a.regularAmount) + additive,
        month,
        year,
      });
    }

    // PA
    if (a.paStaffId) {
      add({
        staffId: a.paStaffId,
        name: a.paStaffName,
        category: "regular",
        routeLabel,
        role: "PA",
        days: a.paDays,
        amount: a.paAmount,
        month,
        year,
      });
    }

    // Cover — new style (coverEntries) or old style (temp fields)
    if (a.coverEntries?.length > 0) {
      a.coverEntries.forEach((c) => {
        const onStaffList =
          c.staffId && !c.isExternal && staffById.has(c.staffId);
        add({
          staffId: onStaffList ? c.staffId : null,
          name: c.staffName,
          category: onStaffList ? "cover" : "external",
          routeLabel,
          role: c.role === "pa" ? "Cover PA" : "Cover",
          days: c.days,
          amount: c.amount,
          month,
          year,
        });
      });
    } else if (num(a.tempAmount) > 0) {
      const onStaffList = a.tempStaffId && staffById.has(a.tempStaffId);
      add({
        staffId: onStaffList ? a.tempStaffId : null,
        name: a.tempStaffName,
        category: onStaffList ? "cover" : "external",
        routeLabel,
        role: "Cover",
        days: a.tempDays,
        amount: a.tempAmount,
        month,
        year,
      });
    }

    // Additive bands paid to someone other than the main driver
    (a.additiveEntries || [])
      .filter((e) => e.staffId && e.staffId !== a.regularStaffId)
      .forEach((e) => {
        add({
          staffId: staffById.has(e.staffId) ? e.staffId : null,
          name: e.staffName,
          category: staffById.has(e.staffId) ? "cover" : "external",
          routeLabel,
          role: e.description || "Extra",
          days: e.days,
          amount: e.amount,
          month,
          year,
        });
      });
  });

  return people;
}

// Same person key everywhere: staff by id, external temps by name
const personKey = (staffId, name) =>
  staffId ? `staff:${staffId}` : `ext:${(name || "").trim().toLowerCase()}`;

/**
 * Who should have an invoice for a month, and where each one stands.
 *
 * Rule agreed 24 Nov 2026: anyone with an allocation over £0 that month.
 *  - regular:  the main driver or PA on an allocation → must submit (chased)
 *  - cover:    on the staff list but only covering → not chased; the office
 *              can mark them "recorded by office" instead
 *  - external: not on the staff list (temps) → not chased; recorded by office
 *
 * mustSubmitTypes (Settings → Invoice submissions): which staff types are
 * chased when they are the regular driver/PA, e.g. ["driver", "pa"].
 * Not set = every type. A regular whose type isn't listed is treated like
 * cover: not chased, the office records them.
 *
 * @returns {{ people: Array, summary: Object }}
 */
export const ALL_STAFF_TYPES = ["driver", "pa", "driver_pa"];

export function getExpectedSubmissions({
  month,
  year,
  allocations = [],
  staff = [],
  submissions = [],
  mustSubmitTypes = null,
}) {
  const chasedTypes = Array.isArray(mustSubmitTypes)
    ? mustSubmitTypes
    : ALL_STAFF_TYPES;
  const m = Number(month);
  const y = Number(year);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const people = collectEarnings(
    allocations,
    staffById,
    (a) => Number(a.month) === m && Number(a.year) === y,
  );

  // Match each person to their best submission for the month
  const monthSubs = submissions.filter(
    (s) => Number(s.month) === m && Number(s.year) === y,
  );
  const result = [...people.values()].map((p) => {
    const theirs = monthSubs.filter((s) =>
      p.staffId
        ? s.staffId === p.staffId
        : !s.staffId &&
          (s.staffName || "").trim().toLowerCase() ===
            p.name.trim().toLowerCase(),
    );
    const best = theirs.sort(
      (a, b) => (STATUS_RANK[b.status] || 0) - (STATUS_RANK[a.status] || 0),
    )[0];
    const status = best?.status || "missing";
    const received = RECEIVED_STATUSES.includes(status);
    const mustSubmit =
      p.category === "regular" && chasedTypes.includes(p.staffType || "driver");
    return {
      ...p,
      submission: best || null,
      status, // approved | submitted | office_recorded | recalled | rejected | missing
      received,
      mustSubmit,
      needsChasing: mustSubmit && !received,
      canRecordByOffice: !mustSubmit && !received,
    };
  });

  // Regular first, then by name
  result.sort(
    (a, b) =>
      CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category] ||
      a.name.localeCompare(b.name),
  );

  const regular = result.filter((p) => p.mustSubmit);
  const others = result.filter((p) => !p.mustSubmit);
  const summary = {
    expected: result.length,
    received: result.filter((p) => p.received).length,
    regularExpected: regular.length,
    regularReceived: regular.filter((p) => p.received).length,
    missing: regular.filter((p) => !p.received).length, // to chase
    toRecord: others.filter((p) => !p.received).length, // office can record
    missingAmount: round2(
      regular
        .filter((p) => !p.received)
        .reduce((s, p) => s + p.expectedAmount, 0),
    ),
  };
  summary.complete = summary.missing === 0 && summary.toRecord === 0;

  return { people: result, summary };
}

// ── Who we owe for a month (Pay run) ────────────────────────────────────────
// Everyone with money due for the work month — regular, cover, PA and
// external temps — plus anyone with a balance still open from earlier months.
//
//   brought forward = earned − paid − deductions, for all months before this one
//   net to pay      = brought forward + earned this month − paid for this month
//                     − deductions due this month
//
// Payments count against the work month they were for (periodMonth/Year).
// Deductions count in the month they are due to come off; waived ones are ignored.
const periodKey = (month, year) => Number(year) * 12 + Number(month);

export function getPayables({
  month,
  year,
  allocations = [],
  staff = [],
  payments = [],
  staffCharges = [],
}) {
  const target = periodKey(month, year);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Earnings up to and including this month
  const earnings = collectEarnings(
    allocations,
    staffById,
    (a) => periodKey(a.month, a.year) <= target,
  );

  const rows = new Map();
  const row = (staffId, name, isExternal) => {
    const onList = staffId && staffById.has(staffId);
    const key = personKey(
      onList || (staffId && !isExternal) ? staffId : null,
      name,
    );
    let r = rows.get(key);
    if (!r) {
      const s = staffId ? staffById.get(staffId) : null;
      r = {
        key,
        staffId: onList ? staffId : staffId && !isExternal ? staffId : null,
        name: s?.name || name || "Unknown",
        phone: s?.phone || "",
        staffType: s?.type || "",
        isExternal: !onList && (isExternal || !staffId),
        category: null,
        broughtForward: 0,
        earned: 0,
        paid: 0,
        deductions: 0,
        earnedLines: [],
        paymentsThisMonth: [],
        chargesThisMonth: [],
        outstandingCharges: [], // due this month or earlier, not yet taken off
        upcomingCharges: [], // due in later months
      };
      rows.set(key, r);
    }
    return r;
  };

  // Earnings
  earnings.forEach((p) => {
    const r = row(p.staffId, p.name, !p.staffId);
    r.category = p.category;
    p.lines.forEach((l) => {
      if (periodKey(l.month, l.year) === target) {
        r.earned += l.amount;
        r.earnedLines.push(l);
      } else {
        r.broughtForward += l.amount;
      }
    });
  });

  // Payments — against the work month they were for
  payments.forEach((p) => {
    const pm = p.periodMonth ?? p.month;
    const py = p.periodYear ?? p.year;
    const k = periodKey(pm, py);
    if (k > target) return; // paid in advance for a later month
    const r = row(
      p.isExternal ? null : p.staffId,
      p.externalName,
      p.isExternal,
    );
    const amount = num(p.amount);
    if (k === target) {
      r.paid += amount;
      r.paymentsThisMonth.push(p);
    } else {
      r.broughtForward -= amount;
    }
  });

  // Deductions
  staffCharges
    .filter((c) => c.status !== "waived")
    .forEach((c) => {
      const k = periodKey(c.deductMonth, c.deductYear);
      const r = row(c.isExternal ? null : c.staffId, c.staffName, c.isExternal);
      if (k > target) {
        if (c.status === "outstanding") r.upcomingCharges.push(c);
        return;
      }
      if (c.status === "outstanding") r.outstandingCharges.push(c);
      if (k === target) {
        r.deductions += num(c.amount);
        r.chargesThisMonth.push(c);
      } else {
        r.broughtForward -= num(c.amount);
      }
    });

  const result = [...rows.values()]
    .map((r) => {
      const out = {
        ...r,
        broughtForward: round2(r.broughtForward),
        earned: round2(r.earned),
        paid: round2(r.paid),
        deductions: round2(r.deductions),
      };
      out.netToPay = round2(
        out.broughtForward + out.earned - out.paid - out.deductions,
      );
      out.overpaid = out.netToPay < -0.01;
      out.settled = Math.abs(out.netToPay) <= 0.01;
      out.hasDeductions = out.outstandingCharges.length > 0;
      return out;
    })
    .filter(
      (r) =>
        r.earned > 0 ||
        r.paid > 0 ||
        r.deductions > 0 ||
        Math.abs(r.broughtForward) > 0.01 ||
        r.outstandingCharges.length > 0,
    )
    .sort((a, b) => b.netToPay - a.netToPay || a.name.localeCompare(b.name));

  const summary = {
    people: result.length,
    toPay: result.filter((r) => r.netToPay > 0.01).length,
    totalToPay: round2(
      result.filter((r) => r.netToPay > 0).reduce((s, r) => s + r.netToPay, 0),
    ),
    totalEarned: round2(result.reduce((s, r) => s + r.earned, 0)),
    totalPaid: round2(result.reduce((s, r) => s + r.paid, 0)),
    totalDeductions: round2(result.reduce((s, r) => s + r.deductions, 0)),
    overpaid: result.filter((r) => r.overpaid).length,
    withDeductions: result.filter((r) => r.hasDeductions).length,
  };

  return { rows: result, summary };
}
