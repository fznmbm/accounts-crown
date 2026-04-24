import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import EmptyState from "../components/EmptyState";
import {
  uid,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
} from "../lib/utils";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const NO_RUN_REASONS = [
  { value: "school_closed", label: "School closed (INSET / holiday)" },
  { value: "all_children_absent", label: "All children absent" },
  { value: "vehicle_issue", label: "Vehicle issue" },
  { value: "driver_absent", label: "Driver absent — no cover arranged" },
  { value: "other", label: "Other" },
];

// Get all Mon–Fri dates for a given month/year
function getWorkingDays(month, year) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function dateKey(d) {
  return d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : d;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const STATUS_STYLE = {
  ran: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  half_day:
    "bg-blue-100  dark:bg-blue-900/30  text-blue-700  dark:text-blue-400  border-blue-200  dark:border-blue-800",
  no_run:
    "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400   border-red-200   dark:border-red-800",
  cover:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  empty:
    "bg-gray-50   dark:bg-gray-800/50  text-gray-300  dark:text-gray-600  border-gray-100  dark:border-gray-700",
};

export default function Attendance() {
  const {
    routes,
    staff,
    pupils,
    attendance,
    setAttendance,
    holidays,
    allocations,
    setAllocations,
  } = useApp();

  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [editing, setEditing] = useState(null); // { date, routeId }
  const [form, setForm] = useState(null);

  const activeRoutes = routes.filter((r) => r.active && !r.suspended);
  const workingDays = getWorkingDays(month, year);
  const drivers = staff.filter(
    (s) => s.type === "driver" || s.type === "driver_pa",
  );
  const pas = staff.filter((s) => s.type === "pa" || s.type === "driver_pa");

  // Index attendance by date+routeId for fast lookup
  const attIndex = useMemo(() => {
    const idx = {};
    attendance
      .filter((a) => a.month === month && a.year === year)
      .forEach((a) => {
        idx[`${a.date}_${a.routeId}`] = a;
      });
    return idx;
  }, [attendance, month, year]);

  // Get attendance record or null
  const getAtt = (date, routeId) =>
    attIndex[`${dateKey(date)}_${routeId}`] || null;

  const isHoliday = (date, routeId) => {
    const key = dateKey(date);
    return holidays.some(
      (h) => h.date === key && (h.allRoutes || h.routeIds?.includes(routeId)),
    );
  };

  const getHolidayLabel = (date) => {
    const key = dateKey(date);
    return holidays.find((h) => h.date === key)?.label || "";
  };

  // Cell display
  const getCellStatus = (att) => {
    if (!att) return "empty";
    if (att.status === "no_run") return "no_run";
    if (att.status === "half_day") return "half_day";
    if (att.isCoverDriver) return "cover";
    return "ran";
  };

  const getCellLabel = (att, route) => {
    if (!att) return "";
    if (att.status === "no_run") return "✕";
    if (att.status === "half_day") return "½";
    if (att.isCoverDriver) return att.driverName?.split(" ")[0] || "~";
    const driver = staff.find((s) => s.id === att.driverId);
    return driver?.name?.split(" ")[0] || "✓";
  };

  // Open cell editor
  const openCell = (date, route) => {
    const existing = getAtt(date, route.id);
    const routePupils = pupils.filter(
      (p) => p.routeId === route.id && p.status === "active",
    );
    const primaryDriver = staff.find((s) => s.id === route.primaryDriverId);
    const primaryPA = staff.find((s) => s.id === route.primaryPAId);

    setForm({
      id: existing?.id || uid(),
      date: dateKey(date),
      routeId: route.id,
      routeNumber: route.number,
      routeName: route.name,
      status: existing?.status || "ran",
      daysValue: existing?.daysValue ?? 1,
      driverId: existing?.driverId || route.primaryDriverId || "",
      driverName: existing?.driverName || primaryDriver?.name || "",
      isCoverDriver: existing?.isCoverDriver || false,
      paId: existing?.paId || route.primaryPAId || "",
      paName: existing?.paName || primaryPA?.name || "",
      isCoverPA: existing?.isCoverPA || false,
      childrenAttendance:
        existing?.childrenAttendance ||
        routePupils.map((p) => ({
          childId: p.id,
          name: `${p.firstName} ${p.lastName}`,
          attended: true,
          absenceReason: "",
        })),
      noRunReason: existing?.noRunReason || "",
      notes: existing?.notes || "",
      _routePupils: routePupils,
      _isNew: !existing,
    });
    setEditing({ date: dateKey(date), routeId: route.id, route });
  };

  const closeCell = () => {
    setEditing(null);
    setForm(null);
  };

  const saveCell = () => {
    if (!form) return;
    const record = {
      id: form.id,
      month,
      year,
      date: form.date,
      routeId: form.routeId,
      routeNumber: form.routeNumber,
      status: form.status,
      daysValue:
        form.status === "no_run" ? 0 : form.status === "half_day" ? 0.5 : 1,
      driverId: form.driverId,
      driverName: form.driverName,
      isCoverDriver: form.isCoverDriver,
      paId: form.paId,
      paName: form.paName,
      isCoverPA: form.isCoverPA,
      childrenAttendance: form.childrenAttendance,
      noRunReason: form.noRunReason,
      notes: form.notes,
      createdAt: Date.now(),
    };
    const key = `${record.date}_${record.routeId}`;
    const existing = Object.values(attIndex).find(
      (a) => a.date === record.date && a.routeId === record.routeId,
    );
    const updated = existing
      ? attendance.map((a) =>
          a.date === record.date && a.routeId === record.routeId ? record : a,
        )
      : [...attendance, record];
    setAttendance(updated);
    closeCell();
  };

  const delCell = () => {
    if (!form) return;
    if (confirm("Clear this attendance record?")) {
      setAttendance(
        attendance.filter(
          (a) => !(a.date === form.date && a.routeId === form.routeId),
        ),
      );
      closeCell();
    }
  };

  const bulkFillDay = (date) => {
    const dateStr = dateKey(date);
    const newRecords = [];

    activeRoutes.forEach((r) => {
      const existing = getAtt(date, r.id);
      if (existing) return; // skip if already recorded
      if (isHoliday(date, r.id)) return; // skip holidays

      const primaryDriver = staff.find((s) => s.id === r.primaryDriverId);
      const primaryPA = staff.find((s) => s.id === r.primaryPAId);
      const routePupils = pupils.filter(
        (p) => p.routeId === r.id && p.status === "active",
      );

      newRecords.push({
        id: uid(),
        month,
        year,
        date: dateStr,
        routeId: r.id,
        routeNumber: r.number,
        status: "ran",
        daysValue: 1,
        driverId: r.primaryDriverId || "",
        driverName: primaryDriver?.name || "",
        isCoverDriver: false,
        paId: r.primaryPAId || "",
        paName: primaryPA?.name || "",
        isCoverPA: false,
        childrenAttendance: routePupils.map((p) => ({
          childId: p.id,
          name: `${p.firstName} ${p.lastName}`,
          attended: true,
          absenceReason: "",
        })),
        noRunReason: "",
        notes: "",
        createdAt: Date.now(),
      });
    });

    if (newRecords.length === 0) return;
    setAttendance([...attendance, ...newRecords]);
  };

  const generateAllocations = () => {
    const monthAtt = attendance.filter(
      (a) => a.month === month && a.year === year && a.status !== "no_run",
    );

    if (monthAtt.length === 0) {
      alert(
        "No attendance records found for this month. Fill in the attendance register first.",
      );
      return;
    }

    const withDriver = monthAtt.filter((a) => a.driverId && a.driverId !== "");
    if (withDriver.length === 0) {
      alert(
        `Found ${monthAtt.length} attendance records but none have a driver assigned.\n\nMake sure your routes have a Primary Driver set in the Routes page, then re-run "Fill month" to refresh the attendance data.`,
      );
      return;
    }

    // Group by route

    // Group by route
    const byRoute = {};
    monthAtt.forEach((a) => {
      if (!byRoute[a.routeId]) byRoute[a.routeId] = [];
      byRoute[a.routeId].push(a);
    });

    // For each route calculate driver splits
    const newAllocations = [];
    const skipped = [];

    Object.entries(byRoute).forEach(([routeId, records]) => {
      const route = routes.find((r) => r.id === routeId);
      if (!route) return;

      // Check if allocation already exists for this route/month
      const existing = allocations.find(
        (a) => a.routeId === routeId && a.month === month && a.year === year,
      );
      if (existing) {
        skipped.push(route.number);
        return;
      }

      // Total days
      const totalDays = records.reduce((s, a) => s + (a.daysValue ?? 1), 0);

      // Group days by driver
      const driverDays = {};
      records.forEach((a) => {
        const key = a.driverId || a.driverName || null;
        if (!key) return;
        if (!driverDays[key]) {
          driverDays[key] = {
            driverId: a.driverId || "",
            name: a.driverName || "",
            days: 0,
            isCover: a.isCoverDriver,
          };
        }
        driverDays[key].days += a.daysValue ?? 1;
      });

      const driverArr = Object.values(driverDays).sort(
        (a, b) => b.days - a.days,
      );
      const regular = driverArr[0];
      const cover = driverArr[1];

      if (!regular) return;

      const regularStaff = staff.find((s) => s.id === regular.driverId);
      const regularRate = route.driverDailyRate || 0;
      const regularAmount = Math.round(regular.days * regularRate * 100) / 100;

      let tempStaffId = null,
        tempStaffName = "",
        tempDays = 0,
        tempRate = 0,
        tempAmount = 0;
      if (cover) {
        const coverStaff = staff.find((s) => s.id === cover.driverId);
        tempStaffId = cover.driverId;
        tempStaffName = cover.name || coverStaff?.name || "";
        tempDays = cover.days;
        tempRate = regularRate; // default same rate — user can edit
        tempAmount = Math.round(cover.days * tempRate * 100) / 100;
      }

      newAllocations.push({
        id: uid(),
        routeId,
        routeNumber: route.number,
        routeName: route.name,
        month,
        year,
        totalDays,
        regularStaffId: regular.driverId,
        regularDays: regular.days,
        regularRate,
        regularAmount,
        tempStaffId,
        tempStaffName,
        tempDays,
        tempRate,
        tempAmount,
        absenceReason: "",
        notes: "Auto-generated from attendance register",
        createdAt: Date.now(),
      });
    });

    if (newAllocations.length === 0 && skipped.length > 0) {
      alert(
        `All routes already have allocations for ${MONTHS[month]} ${year}.`,
      );
      return;
    }

    const msg = [
      `Generate ${newAllocations.length} allocation${newAllocations.length !== 1 ? "s" : ""} from attendance?`,
      skipped.length > 0
        ? `\nSkipping ${skipped.length} routes with existing allocations: ${skipped.join(", ")}`
        : "",
      "\nYou can review and edit them in the Allocations page afterwards.",
    ].join("");

    if (confirm(msg)) {
      setAllocations([...allocations, ...newAllocations]);
      alert(
        `✓ Created ${newAllocations.length} allocation${newAllocations.length !== 1 ? "s" : ""}. Go to Allocations to review and adjust rates if needed.`,
      );
    }
  };

  // ── Month totals ──────────────────────────────────────────────────────────
  const routeTotals = useMemo(() => {
    const totals = {};
    activeRoutes.forEach((r) => {
      const records = attendance.filter(
        (a) => a.routeId === r.id && a.month === month && a.year === year,
      );
      totals[r.id] = records.reduce((s, a) => s + (a.daysValue ?? 1), 0);
    });
    return totals;
  }, [attendance, month, year, activeRoutes]);

  // ── Driver totals ──────────────────────────────────────────────────────────
  const driverTotals = useMemo(() => {
    const totals = {};
    const monthAtt = attendance.filter(
      (a) => a.month === month && a.year === year && a.status !== "no_run",
    );
    monthAtt.forEach((a) => {
      if (!a.driverId) return;
      if (!totals[a.driverId]) totals[a.driverId] = 0;
      totals[a.driverId] += a.daysValue ?? 1;
    });
    return totals;
  }, [attendance, month, year]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleDriverChange = (e) => {
    const s = staff.find((x) => x.id === e.target.value);
    setForm((p) => ({
      ...p,
      driverId: e.target.value,
      driverName: s?.name || "",
      isCoverDriver: e.target.value !== (editing?.route?.primaryDriverId || ""),
    }));
  };

  const handlePAChange = (e) => {
    const s = staff.find((x) => x.id === e.target.value);
    setForm((p) => ({
      ...p,
      paId: e.target.value,
      paName: s?.name || "",
      isCoverPA: e.target.value !== (editing?.route?.primaryPAId || ""),
    }));
  };

  const toggleChildAttendance = (childId, attended) => {
    setForm((p) => ({
      ...p,
      childrenAttendance: p.childrenAttendance.map((c) =>
        c.childId === childId
          ? { ...c, attended, absenceReason: attended ? "" : c.absenceReason }
          : c,
      ),
    }));
  };

  const setChildAbsenceReason = (childId, reason) => {
    setForm((p) => ({
      ...p,
      childrenAttendance: p.childrenAttendance.map((c) =>
        c.childId === childId ? { ...c, absenceReason: reason } : c,
      ),
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Attendance Register"
        subtitle="Daily record of who drove, who attended, and whether each route ran"
        actions={
          <div className="flex gap-2">
            <select
              className="input w-36"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
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
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              className="btn-secondary text-sm"
              onClick={() => {
                const unrecorded = workingDays.filter((d) =>
                  activeRoutes.some((r) => !getAtt(d, r.id)),
                );
                if (unrecorded.length === 0) {
                  alert("All days already recorded.");
                  return;
                }
                if (
                  confirm(
                    `Mark all unrecorded days (${unrecorded.length} days × ${activeRoutes.length} routes) as ran with regular drivers?`,
                  )
                ) {
                  unrecorded.forEach((d) => bulkFillDay(d));
                }
              }}
            >
              Fill month
            </button>
            <button
              className="btn-primary text-sm"
              onClick={generateAllocations}
            >
              → Generate allocations
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Main grid ── */}
        <div className="flex-1 overflow-auto">
          {activeRoutes.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon="📋"
                title="No active routes"
                description="Add active routes to start recording attendance."
              />
            </div>
          ) : (
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  {/* Date column header */}
                  <th className="sticky left-0 z-20 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 w-28 min-w-[7rem]">
                    Date
                  </th>
                  {/* Route headers */}
                  {activeRoutes.map((r) => (
                    <th
                      key={r.id}
                      className="bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 px-2 py-2 text-center min-w-[80px] w-20"
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {r.number}
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 truncate text-[10px]">
                        {r.name?.split(" ")[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workingDays.map((day) => (
                  <tr key={dateKey(day)} className="group">
                    {/* Date cell */}
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-gray-700 dark:text-gray-300">
                          {fmtDate(day)}
                        </div>
                        {(() => {
                          const unrecorded = activeRoutes.filter(
                            (r) => !getAtt(day, r.id) && !isHoliday(day, r.id),
                          ).length;
                          return unrecorded > 0 ? (
                            <button
                              onClick={() => bulkFillDay(day)}
                              title={`Mark all ${unrecorded} unrecorded routes as ran with regular driver`}
                              className="opacity-0 group-hover:opacity-100 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-all flex-shrink-0"
                            >
                              +{unrecorded}
                            </button>
                          ) : (
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0">
                              ✓
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    {/* Route cells */}
                    {activeRoutes.map((route) => {
                      const hol = isHoliday(day, route.id);
                      const att = getAtt(day, route.id);
                      const status = getCellStatus(att);
                      const label = getCellLabel(att, route);
                      const isOpen =
                        editing?.date === dateKey(day) &&
                        editing?.routeId === route.id;
                      return (
                        <td
                          key={route.id}
                          className="border-b border-r border-gray-100 dark:border-gray-700/50 p-1"
                        >
                          {hol ? (
                            <div
                              title={getHolidayLabel(day)}
                              className="w-full h-9 rounded-lg border text-xs font-semibold flex items-center justify-center bg-gray-100 dark:bg-gray-700/50 text-gray-300 dark:text-gray-600 border-gray-100 dark:border-gray-700 cursor-default select-none"
                            >
                              🏖
                            </div>
                          ) : (
                            <button
                              onClick={() => openCell(day, route)}
                              className={`w-full h-9 rounded-lg border text-xs font-semibold transition-all ${STATUS_STYLE[status]} ${isOpen ? "ring-2 ring-blue-400 ring-offset-1" : "hover:opacity-80"}`}
                            >
                              {label}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/50 border-t-2 border-r border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-gray-900 dark:text-gray-100 text-xs">
                    Total days
                  </td>
                  {activeRoutes.map((r) => (
                    <td
                      key={r.id}
                      className="border-t-2 border-r border-gray-300 dark:border-gray-600 px-2 py-2 text-center"
                    >
                      <span
                        className={`font-bold text-sm ${routeTotals[r.id] > 0 ? "text-blue-700 dark:text-blue-400" : "text-gray-300 dark:text-gray-600"}`}
                      >
                        {routeTotals[r.id] || 0}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ── Right panel: summary ── */}
        <div className="w-56 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Driver days — {MONTHS_SHORT[month]}
            </p>
            {Object.keys(driverTotals).length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                No records yet
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(driverTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([driverId, days]) => {
                    const s = staff.find((x) => x.id === driverId);
                    if (!s) return null;
                    return (
                      <div
                        key={driverId}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                            {s.name[0]}
                          </div>
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                            {s.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex-shrink-0 ml-1">
                          {days}d
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Legend
            </p>
            <div className="space-y-1.5">
              {[
                { style: STATUS_STYLE.ran, label: "Ran — regular driver" },
                { style: STATUS_STYLE.cover, label: "Ran — cover driver" },
                { style: STATUS_STYLE.half_day, label: "Half day" },
                { style: STATUS_STYLE.no_run, label: "Did not run" },
                { style: STATUS_STYLE.empty, label: "Not recorded" },
              ].map(({ style, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-4 rounded border text-[9px] flex items-center justify-center font-bold ${style}`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cell edit modal ── */}
      {form && editing && (
        <Modal
          title={`${fmtDate(form.date)} — Route ${form.routeNumber}`}
          onClose={closeCell}
          size="md"
        >
          <div className="space-y-4">
            {/* Status */}
            <FormField label="Did the route run?">
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: "ran",
                    label: "✓ Ran",
                    style:
                      "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
                  },
                  {
                    value: "half_day",
                    label: "½ Half day",
                    style:
                      "border-blue-300  dark:border-blue-700  bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-400",
                  },
                  {
                    value: "no_run",
                    label: "✕ No run",
                    style:
                      "border-red-300   dark:border-red-700   bg-red-50   dark:bg-red-900/20   text-red-700   dark:text-red-400",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({ ...p, status: opt.value }))
                    }
                    className={`py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                      form.status === opt.value
                        ? opt.style
                        : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </FormField>

            {/* No run reason */}
            {form.status === "no_run" && (
              <FormField label="Reason">
                <select
                  className="input"
                  value={form.noRunReason}
                  onChange={f("noRunReason")}
                >
                  <option value="">Select reason…</option>
                  {NO_RUN_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {/* Driver + PA */}
            {form.status !== "no_run" && (
              <>
                <FormGrid cols={2}>
                  <FormField
                    label="Driver"
                    hint={form.isCoverDriver ? "⚠ Cover driver" : "✓ Regular"}
                  >
                    <select
                      className="input"
                      value={form.driverId}
                      onChange={handleDriverChange}
                    >
                      <option value="">Select driver…</option>
                      {drivers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    label="PA (if applicable)"
                    hint={
                      form.paId && form.isCoverPA
                        ? "⚠ Cover PA"
                        : form.paId
                          ? "✓ Regular"
                          : ""
                    }
                  >
                    <select
                      className="input"
                      value={form.paId}
                      onChange={handlePAChange}
                    >
                      <option value="">No PA</option>
                      {pas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </FormGrid>

                {/* Children attendance */}
                {form.childrenAttendance?.length > 0 && (
                  <FormField label="Children">
                    <div className="space-y-2 mt-1">
                      {form.childrenAttendance.map((c) => (
                        <div
                          key={c.childId}
                          className={`p-2.5 rounded-lg border ${c.attended ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {c.name}
                            </span>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleChildAttendance(c.childId, true)
                                }
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${c.attended ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/20"}`}
                              >
                                ✓ In
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleChildAttendance(c.childId, false)
                                }
                                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${!c.attended ? "bg-red-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20"}`}
                              >
                                ✕ Absent
                              </button>
                            </div>
                          </div>
                          {!c.attended && (
                            <select
                              className="input mt-2 text-xs py-1"
                              value={c.absenceReason}
                              onChange={(e) =>
                                setChildAbsenceReason(c.childId, e.target.value)
                              }
                            >
                              <option value="">Select absence reason…</option>
                              <option value="sick">Sick</option>
                              <option value="holiday">Holiday</option>
                              <option value="school_closed">
                                School closed
                              </option>
                              <option value="other">Other</option>
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </FormField>
                )}
              </>
            )}

            <FormField label="Notes">
              <input
                className="input"
                value={form.notes}
                onChange={f("notes")}
                placeholder="Any notes for this day…"
              />
            </FormField>
          </div>

          <ModalFooter>
            {!form._isNew && (
              <button className="btn-danger mr-auto" onClick={delCell}>
                Clear record
              </button>
            )}
            <button className="btn-secondary" onClick={closeCell}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveCell}>
              Save
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
