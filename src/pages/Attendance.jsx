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
  { value: "inset_day", label: "INSET day", color: "orange" },
  { value: "bank_holiday", label: "Bank holiday", color: "yellow" },
  { value: "school_holiday", label: "School holiday", color: "yellow" },
  { value: "all_children_absent", label: "All children absent", color: "red" },
  { value: "vehicle_issue", label: "Vehicle issue", color: "red" },
  {
    value: "driver_absent",
    label: "Driver absent — no cover arranged",
    color: "red",
  },
  {
    value: "non_operational",
    label: "Non-operational day (route doesn't run today)",
    color: "dark",
  },
  { value: "other", label: "Other", color: "red" },
];

// Get all Mon–Fri dates for a given month/year
function getAllDays(month, year) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getWorkingDays(month, year, activeRoutes) {
  const all = getAllDays(month, year);
  // Collect all days of week any route operates on
  const neededDows = new Set();
  activeRoutes.forEach((r) => {
    const opDays = r.operationalDays || [1, 2, 3, 4, 5];
    opDays.forEach((d) => neededDows.add(d));
  });
  // Always include Mon-Fri minimum
  [1, 2, 3, 4, 5].forEach((d) => neededDows.add(d));
  return all.filter((d) => neededDows.has(d.getDay()));
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
  split:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  empty:
    "bg-gray-50   dark:bg-gray-800/50  text-gray-300  dark:text-gray-600  border-gray-100  dark:border-gray-700",
  no_run_orange:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  no_run_yellow:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  no_run_red:
    "bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400    border-red-200    dark:border-red-800",
  no_run_dark:
    "bg-gray-200   dark:bg-gray-700      text-gray-500   dark:text-gray-400   border-gray-300   dark:border-gray-600",
};

const NO_RUN_STYLE = {
  orange:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  yellow:
    "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  red: "bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400    border-red-200    dark:border-red-800",
  dark: "bg-gray-200   dark:bg-gray-700      text-gray-500   dark:text-gray-400   border-gray-300   dark:border-gray-600",
};

export default function Attendance() {
  const {
    routes,
    staff,
    pupils,
    attendance,
    setAttendance,
    deleteAttendanceRecords,
    holidays,
    allocations,
    setAllocations,
  } = useApp();

  // const [month, setMonth] = useState(currentMonth());
  // const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(() => {
    const saved = localStorage.getItem("att_month");
    return saved !== null ? parseInt(saved) : currentMonth();
  });
  const [year, setYear] = useState(() => {
    const saved = localStorage.getItem("att_year");
    return saved !== null ? parseInt(saved) : currentYear();
  });

  const [editing, setEditing] = useState(null); // { date, routeId }
  const [form, setForm] = useState(null);

  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkRoute, setBulkRoute] = useState(null);
  const [bulkDriverId, setBulkDriverId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("ran");
  const [bulkDates, setBulkDates] = useState([]);
  const [noRunOtherText, setNoRunOtherText] = useState("");

  const [clipboard, setClipboard] = useState(null); // { status, driverId, driverName, ... }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, date, route }

  const activeRoutes = routes.filter((r) => r.active && !r.suspended);
  const workingDays = getWorkingDays(month, year, activeRoutes);
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

  const isNonOperational = (date, routeId) => {
    const route = activeRoutes.find((r) => r.id === routeId);
    if (!route) return false;
    const opDays = route.operationalDays || [1, 2, 3, 4, 5];
    const dow = (date instanceof Date ? date : new Date(date)).getDay();
    return !opDays.includes(dow);
  };

  const getHolidayLabel = (date) => {
    const key = dateKey(date);
    return holidays.find((h) => h.date === key)?.label || "";
  };

  // Cell display
  const getCellStatus = (att) => {
    if (!att) return "empty";
    if (att.status === "no_run") {
      const reason = NO_RUN_REASONS.find((r) => r.value === att.noRunReason);
      return reason ? `no_run_${reason.color}` : "no_run";
    }
    if (att.status === "half_day") return "half_day";
    if (att.isSplitRun) return "split";
    if (att.isCoverDriver) return "cover";
    return "ran";
  };

  const getCellLabel = (att, route) => {
    if (!att) return "";
    if (att.status === "no_run") {
      const reason = NO_RUN_REASONS.find((r) => r.value === att.noRunReason);
      if (att.noRunReason === "inset_day") return "INSET";
      if (att.noRunReason === "bank_holiday") return "BH";
      if (att.noRunReason === "school_holiday") return "SH";
      if (att.noRunReason === "non_operational") return "—";
      return "✕";
    }
    if (att.status === "half_day") return "½";
    if (att.isSplitRun) {
      const am = att.amDriverName?.split(" ")[0] || "?";
      const pm =
        att.pmDriverName?.split(" ")[0] ||
        att.amDriverName?.split(" ")[0] ||
        "?";
      return `${am}/${pm}`;
    }
    if (att.isExternalDriver)
      return `EXT:${att.externalDriverName?.split(" ")[0] || "?"}`;
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
      isSplitRun: existing?.isSplitRun || false,
      isExternalDriver: existing?.isExternalDriver || false,
      externalDriverName: existing?.externalDriverName || "",
      isExternalPA: existing?.isExternalPA || false,
      externalPAName: existing?.externalPAName || "",
      amDriverId: existing?.amDriverId || route.primaryDriverId || "",
      amDriverName: existing?.amDriverName || primaryDriver?.name || "",
      pmDriverId: existing?.pmDriverId || "",
      pmDriverName: existing?.pmDriverName || "",
      isExternalAmDriver:
        existing?.isSplitRun &&
        !existing?.amDriverId &&
        !!existing?.amDriverName
          ? true
          : false,
      isExternalPmDriver:
        existing?.isSplitRun &&
        !existing?.pmDriverId &&
        !!existing?.pmDriverName
          ? true
          : false,
      amPaId: existing?.amPaId || route.primaryPAId || "",
      amPaName: existing?.amPaName || primaryPA?.name || "",
      pmPaId: existing?.pmPaId || "",
      pmPaName: existing?.pmPaName || "",

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
      _route: route,
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
      driverId: form.isSplitRun
        ? form.amDriverId || ""
        : form.isExternalDriver
          ? ""
          : form.driverId,
      driverName: form.isSplitRun
        ? form.amDriverName || ""
        : form.isExternalDriver
          ? form.externalDriverName
          : form.driverName,
      isCoverDriver: form.isSplitRun
        ? true
        : form.isExternalDriver
          ? true
          : form.isCoverDriver,
      isSplitRun: form.isSplitRun || false,
      isExternalDriver: form.isExternalDriver || false,
      externalDriverName: form.externalDriverName || "",
      isExternalPA: form.isExternalPA || false,
      externalPAName: form.externalPAName || "",
      amDriverId: form.isSplitRun ? form.amDriverId || null : null,
      amDriverName: form.isSplitRun ? form.amDriverName || null : null,
      pmDriverId: form.isSplitRun ? form.pmDriverId || null : null,
      pmDriverName: form.isSplitRun ? form.pmDriverName || null : null,
      amPaId: form.isSplitRun ? form.amPaId || null : null,
      amPaName: form.isSplitRun ? form.amPaName || null : null,
      pmPaId: form.isSplitRun ? form.pmPaId || null : null,
      pmPaName: form.isSplitRun ? form.pmPaName || null : null,
      paId: form.paId,
      paName: form.paName,
      isCoverPA: form.isCoverPA,
      childrenAttendance: form.childrenAttendance,
      noRunReason:
        form.noRunReason === "other" && noRunOtherText
          ? `other: ${noRunOtherText}`
          : form.noRunReason,
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

  const delCell = async () => {
    if (!form) return;
    if (confirm("Clear this attendance record?")) {
      const toDelete = attendance.find(
        (a) => a.date === form.date && a.routeId === form.routeId,
      );
      setAttendance(
        attendance.filter(
          (a) => !(a.date === form.date && a.routeId === form.routeId),
        ),
      );
      if (toDelete) await deleteAttendanceRecords([toDelete.id]);
      closeCell();
    }
  };

  const bulkFillDay = (date) => {
    const dateStr = dateKey(date);
    const newRecords = [];
    activeRoutes.forEach((r) => {
      if (getAtt(date, r.id)) return;
      if (isHoliday(date, r.id)) return;
      if (isNonOperational(date, r.id)) return;
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
        amDriverId: null,
        amDriverName: null,
        pmDriverId: null,
        pmDriverName: null,
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
    if (newRecords.length > 0) setAttendance([...attendance, ...newRecords]);
  };

  const openBulkAssign = (route) => {
    setBulkRoute(route);
    setBulkDriverId(route.primaryDriverId || "");
    setBulkStatus("ran");
    // Pre-select all recorded days for this route this month
    const recorded = workingDays
      .filter((d) => !isHoliday(d, route.id) && !isNonOperational(d, route.id))
      .map((d) => dateKey(d));
    setBulkDates(recorded);
    setShowBulkAssign(true);
  };

  const saveBulkAssign = () => {
    if (!bulkRoute || !bulkDriverId || bulkDates.length === 0) return;
    const selectedDriver = staff.find((s) => s.id === bulkDriverId);
    const isPrimary = bulkDriverId === bulkRoute.primaryDriverId;
    const primaryPA = staff.find((s) => s.id === bulkRoute.primaryPAId);

    const updated = [...attendance];

    bulkDates.forEach((dateStr) => {
      const existing = updated.find(
        (a) => a.date === dateStr && a.routeId === bulkRoute.id,
      );
      const routePupils = pupils.filter(
        (p) => p.routeId === bulkRoute.id && p.status === "active",
      );

      const record = {
        id: existing?.id || uid(),
        month,
        year,
        date: dateStr,
        routeId: bulkRoute.id,
        routeNumber: bulkRoute.number,
        status: bulkStatus,
        daysValue:
          bulkStatus === "no_run" ? 0 : bulkStatus === "half_day" ? 0.5 : 1,
        driverId: bulkDriverId,
        driverName: selectedDriver?.name || "",
        isCoverDriver: !isPrimary,
        amDriverId: null,
        amDriverName: null,
        pmDriverId: null,
        pmDriverName: null,
        paId: existing?.paId || bulkRoute.primaryPAId || "",
        paName: existing?.paName || primaryPA?.name || "",
        isCoverPA: false,
        childrenAttendance:
          existing?.childrenAttendance ||
          routePupils.map((p) => ({
            childId: p.id,
            name: `${p.firstName} ${p.lastName}`,
            attended: true,
            absenceReason: "",
          })),
        noRunReason: bulkStatus === "no_run" ? "other" : "",
        notes: existing?.notes || "",
        createdAt: existing?.createdAt || Date.now(),
      };

      if (existing) {
        const idx = updated.findIndex((a) => a.id === existing.id);
        updated[idx] = record;
      } else {
        updated.push(record);
      }
    });

    setAttendance(updated);
    setShowBulkAssign(false);
  };

  const pasteRecord = (date, route, sourceAtt) => {
    if (!sourceAtt) return;
    const primaryDriver = staff.find((s) => s.id === route.primaryDriverId);
    const primaryPA = staff.find((s) => s.id === route.primaryPAId);
    const routePupils = pupils.filter(
      (p) => p.routeId === route.id && p.status === "active",
    );
    const existing = getAtt(date, route.id);
    const record = {
      id: existing?.id || uid(),
      month,
      year,
      date: dateKey(date),
      routeId: route.id,
      routeNumber: route.number,
      status: sourceAtt.status,
      daysValue: sourceAtt.daysValue ?? 1,
      driverId: sourceAtt.driverId,
      driverName: sourceAtt.driverName,
      isCoverDriver: sourceAtt.isCoverDriver,
      isSplitRun: sourceAtt.isSplitRun,
      amDriverId: sourceAtt.amDriverId,
      amDriverName: sourceAtt.amDriverName,
      pmDriverId: sourceAtt.pmDriverId,
      pmDriverName: sourceAtt.pmDriverName,
      amPaId: sourceAtt.amPaId,
      amPaName: sourceAtt.amPaName,
      pmPaId: sourceAtt.pmPaId,
      pmPaName: sourceAtt.pmPaName,
      isExternalDriver: sourceAtt.isExternalDriver,
      externalDriverName: sourceAtt.externalDriverName,
      isExternalPA: sourceAtt.isExternalPA,
      externalPAName: sourceAtt.externalPAName,
      paId: sourceAtt.paId,
      paName: sourceAtt.paName,
      isCoverPA: sourceAtt.isCoverPA,
      noRunReason: sourceAtt.noRunReason,
      notes: sourceAtt.notes,
      childrenAttendance:
        existing?.childrenAttendance ||
        routePupils.map((p) => ({
          childId: p.id,
          name: `${p.firstName} ${p.lastName}`,
          attended: true,
          absenceReason: "",
        })),
      createdAt: existing?.createdAt || Date.now(),
    };
    const updated = existing
      ? attendance.map((a) => (a.id === existing.id ? record : a))
      : [...attendance, record];
    setAttendance(updated);
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

      // Filter out non-operational day records (stale data from before operational days were set)
      const opDays = route.operationalDays || [1, 2, 3, 4, 5];
      const opRecords = records.filter((a) => {
        const dow = new Date(a.date).getDay();
        return opDays.includes(dow);
      });

      // Total days — only operational days
      const totalDays = opRecords.reduce((s, a) => s + (a.daysValue ?? 1), 0);

      // Group days by driver
      const driverDays = {};
      opRecords.forEach((a) => {
        // For half days, split between AM and PM drivers
        // Split run — full day but split 0.5 each between AM and PM drivers
        if (a.isSplitRun) {
          // Use name as fallback key for external drivers (no driverId)
          const amKey = a.amDriverId || a.amDriverName || null;
          const pmKey = a.pmDriverId || a.pmDriverName || null;
          if (amKey) {
            if (!driverDays[amKey])
              driverDays[amKey] = {
                driverId: a.amDriverId || "",
                name: a.amDriverName || "",
                days: 0,
                isCover: false,
                isExternal: !a.amDriverId,
              };
            driverDays[amKey].days += 0.5;
          }
          if (pmKey && pmKey !== amKey) {
            if (!driverDays[pmKey])
              driverDays[pmKey] = {
                driverId: a.pmDriverId || "",
                name: a.pmDriverName || "",
                days: 0,
                isCover: true,
                isExternal: !a.pmDriverId,
              };
            driverDays[pmKey].days += 0.5;
          } else if (amKey && !pmKey) {
            // No PM driver — AM driver did both halves
            driverDays[amKey].days += 0.5;
          }
          return;
        }
        // Half day — route genuinely only ran 0.5 days, one driver
        if (a.status === "half_day") {
          const key = a.driverId || null;
          if (!key) return;
          if (!driverDays[key])
            driverDays[key] = {
              driverId: a.driverId,
              name: a.driverName || "",
              days: 0,
              isCover: a.isCoverDriver,
            };
          driverDays[key].days += 0.5;
          return;
        }
        const key =
          a.driverId ||
          (a.isExternalDriver ? a.externalDriverName : null) ||
          a.driverName ||
          null;
        if (!key) return;
        if (!driverDays[key]) {
          driverDays[key] = {
            driverId: a.driverId || "",
            name: a.isExternalDriver
              ? a.externalDriverName
              : a.driverName || "",
            days: 0,
            isCover: a.isCoverDriver,
            isExternal: a.isExternalDriver || false,
          };
        }
        driverDays[key].days += a.daysValue ?? 1;
      });

      // Regular = primary driver on the route, not whoever has most days
      const primaryDriverId = route.primaryDriverId;
      const driverArr = Object.values(driverDays);
      const regular = primaryDriverId
        ? driverArr.find((d) => d.driverId === primaryDriverId) ||
          driverArr.sort((a, b) => b.days - a.days)[0]
        : driverArr.sort((a, b) => b.days - a.days)[0];

      if (!regular) return;

      const regularRate = route.driverDailyRate || 0;
      const regularAmount = Math.round(regular.days * regularRate * 100) / 100;

      // All other drivers = cover entries
      const coverArr = driverArr.filter((d) => d.driverId !== regular.driverId);
      const coverEntries = coverArr.map((c) => {
        const coverStaff = staff.find((s) => s.id === c.driverId);
        const rate = regularRate; // default — user can edit
        return {
          id: uid(),
          staffId: c.driverId || "",
          staffName: c.name || coverStaff?.name || "",
          days: c.days,
          rate,
          amount: Math.round(c.days * rate * 100) / 100,
          isExternal: c.isExternal || !c.driverId,
        };
      });

      // Legacy single temp fields — populate from first cover entry for backwards compat
      const firstCover = coverEntries[0];

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
        // Legacy fields
        tempStaffId: firstCover?.staffId || null,
        tempStaffName: firstCover?.staffName || "",
        tempDays: firstCover?.days || 0,
        tempRate: firstCover?.rate || 0,
        tempAmount: firstCover?.amount || 0,
        // New multiple cover entries
        coverEntries,
        absenceReason: "",
        notes: "Auto-generated from attendance register",
        createdAt: Date.now(),
      });
    }); // ← closes Object.entries(byRoute).forEach

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
      const opDays = r.operationalDays || [1, 2, 3, 4, 5];
      const records = attendance.filter((a) => {
        if (a.routeId !== r.id) return false;
        if (a.month !== month || a.year !== year) return false;
        if (a.status === "no_run") return false;
        // Exclude records that fall on non-operational days
        const dow = new Date(a.date).getDay();
        if (!opDays.includes(dow)) return false;
        return true;
      });
      totals[r.id] = records.reduce((s, a) => s + (a.daysValue ?? 1), 0);
    });
    return totals;
  }, [attendance, month, year, activeRoutes]);

  // ── Driver totals ──────────────────────────────────────────────────────────
  const driverTotals = useMemo(() => {
    // { driverId: { name, total, routes: { routeNumber: days } } }
    const totals = {};
    const monthAtt = attendance.filter((a) => {
      if (a.month !== month || a.year !== year) return false;
      if (a.status === "no_run") return false;
      // Exclude records on non-operational days for that route
      const route = activeRoutes.find((r) => r.id === a.routeId);
      if (route) {
        const opDays = route.operationalDays || [1, 2, 3, 4, 5];
        const dow = new Date(a.date).getDay();
        if (!opDays.includes(dow)) return false;
      }
      return true;
    });

    const addDays = (driverId, driverName, routeNumber, days) => {
      if (!driverId && !driverName) return;
      const key = driverId || driverName;
      if (!totals[key])
        totals[key] = { name: driverName || driverId, total: 0, routes: {} };
      if (!totals[key].routes[routeNumber]) totals[key].routes[routeNumber] = 0;
      totals[key].routes[routeNumber] += days;
      totals[key].total += days;
    };

    monthAtt.forEach((a) => {
      const daysVal = a.daysValue ?? 1;
      if (a.isSplitRun) {
        // AM driver gets 0.5
        if (a.amDriverId || a.amDriverName) {
          addDays(a.amDriverId, a.amDriverName, a.routeNumber, 0.5);
        }
        // PM driver gets 0.5
        if (a.pmDriverId || a.pmDriverName) {
          addDays(a.pmDriverId, a.pmDriverName, a.routeNumber, 0.5);
        }
      } else {
        addDays(a.driverId, a.driverName, a.routeNumber, daysVal);
      }
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
            {/* <select
              className="input w-36"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            > */}
            <select
              className="input w-36"
              value={month}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMonth(val);
                localStorage.setItem("att_month", val);
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            {/* <select
              className="input w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            > */}
            <select
              className="input w-24"
              value={year}
              onChange={(e) => {
                const val = Number(e.target.value);
                setYear(val);
                localStorage.setItem("att_year", val);
              }}
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
                  activeRoutes.some(
                    (r) =>
                      !getAtt(d, r.id) &&
                      !isHoliday(d, r.id) &&
                      !isNonOperational(d, r.id),
                  ),
                );
                if (unrecorded.length === 0) {
                  alert("All days already recorded.");
                  return;
                }
                if (
                  !confirm(
                    `Mark all unrecorded days (${unrecorded.length} days × ${activeRoutes.length} routes) as ran with regular drivers?`,
                  )
                )
                  return;

                // Collect ALL new records first then save once
                const allNewRecords = [];
                unrecorded.forEach((date) => {
                  const dateStr = dateKey(date);
                  activeRoutes.forEach((r) => {
                    const existing = getAtt(date, r.id);
                    if (existing) return;
                    if (isHoliday(date, r.id)) return;
                    if (isNonOperational(date, r.id)) return;
                    const primaryDriver = staff.find(
                      (s) => s.id === r.primaryDriverId,
                    );
                    const primaryPA = staff.find((s) => s.id === r.primaryPAId);
                    const routePupils = pupils.filter(
                      (p) => p.routeId === r.id && p.status === "active",
                    );
                    allNewRecords.push({
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
                      amDriverId: null,
                      amDriverName: null,
                      pmDriverId: null,
                      pmDriverName: null,
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
                });
                if (allNewRecords.length > 0)
                  setAttendance([...attendance, ...allNewRecords]);
              }}
            >
              Fill month
            </button>
            <button
              className="btn-ghost text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={async () => {
                const monthRecords = attendance.filter(
                  (a) => a.month === month && a.year === year,
                );
                if (monthRecords.length === 0) {
                  alert("No records to clear this month.");
                  return;
                }
                if (
                  !confirm(
                    `Clear ALL ${monthRecords.length} attendance records for ${MONTHS[month]} ${year}? This cannot be undone.`,
                  )
                )
                  return;
                const ids = monthRecords.map((a) => a.id);
                const remaining = attendance.filter(
                  (a) => !(a.month === month && a.year === year),
                );
                setAttendance(remaining);
                await deleteAttendanceRecords(ids);
              }}
            >
              Clear month
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
                      className="bg-white dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700 px-2 py-2 text-center min-w-[80px] w-20 group/col"
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {r.number}
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 truncate text-[10px]">
                        {r.name?.split(" ")[0]}
                      </div>
                      <button
                        onClick={() => openBulkAssign(r)}
                        title="Bulk assign driver for this route"
                        className="opacity-0 group-hover/col:opacity-100 transition-all mt-1 text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-semibold hover:bg-blue-200 w-full"
                      >
                        bulk
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workingDays.map((day) => (
                  <tr key={dateKey(day)} className="group">
                    {/* Date cell */}
                    <td
                      className={`sticky left-0 z-10 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-1.5 whitespace-nowrap ${
                        day.getDay() === 0 || day.getDay() === 6
                          ? "bg-orange-50 dark:bg-orange-900/10"
                          : "bg-white dark:bg-gray-900"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`font-semibold ${
                            day.getDay() === 0 || day.getDay() === 6
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {fmtDate(day)}
                        </div>
                        {(() => {
                          const unrecorded = activeRoutes.filter(
                            (r) =>
                              !getAtt(day, r.id) &&
                              !isHoliday(day, r.id) &&
                              !isNonOperational(day, r.id),
                          ).length;
                          const recorded = activeRoutes.filter(
                            (r) => !!getAtt(day, r.id),
                          ).length;
                          return (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {unrecorded > 0 && (
                                <>
                                  <button
                                    onClick={() => bulkFillDay(day)}
                                    title={`Fill ${unrecorded} unrecorded routes`}
                                    className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-semibold hover:bg-green-200 dark:hover:bg-green-900/50"
                                  >
                                    +{unrecorded}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reasons = [
                                        {
                                          value: "inset_day",
                                          label: "INSET day",
                                        },
                                        {
                                          value: "bank_holiday",
                                          label: "Bank holiday",
                                        },
                                        {
                                          value: "school_holiday",
                                          label: "School holiday",
                                        },
                                        {
                                          value: "all_children_absent",
                                          label: "All children absent",
                                        },
                                        {
                                          value: "vehicle_issue",
                                          label: "Vehicle issue",
                                        },
                                        {
                                          value: "driver_absent",
                                          label: "Driver absent",
                                        },
                                        {
                                          value: "non_operational",
                                          label: "Non-operational",
                                        },
                                        { value: "other", label: "Other" },
                                      ];
                                      const chosen = window.prompt(
                                        `Mark all ${unrecorded} unrecorded routes as NO RUN for ${fmtDate(day)}?\n\nEnter reason number:\n` +
                                          reasons
                                            .map(
                                              (r, i) => `${i + 1}. ${r.label}`,
                                            )
                                            .join("\n"),
                                      );
                                      if (!chosen) return;
                                      const idx = parseInt(chosen) - 1;
                                      const reason = reasons[idx];
                                      if (!reason) return;
                                      const dateStr = dateKey(day);
                                      const newRecords = [];
                                      activeRoutes.forEach((r) => {
                                        if (getAtt(day, r.id)) return;
                                        if (isHoliday(day, r.id)) return;
                                        if (isNonOperational(day, r.id)) return;
                                        newRecords.push({
                                          id: uid(),
                                          month,
                                          year,
                                          date: dateStr,
                                          routeId: r.id,
                                          routeNumber: r.number,
                                          status: "no_run",
                                          daysValue: 0,
                                          driverId: "",
                                          driverName: "",
                                          isCoverDriver: false,
                                          isSplitRun: false,
                                          isExternalDriver: false,
                                          externalDriverName: "",
                                          isExternalPA: false,
                                          externalPAName: "",
                                          amDriverId: null,
                                          amDriverName: null,
                                          pmDriverId: null,
                                          pmDriverName: null,
                                          amPaId: null,
                                          amPaName: null,
                                          pmPaId: null,
                                          pmPaName: null,
                                          paId: "",
                                          paName: "",
                                          isCoverPA: false,
                                          childrenAttendance: [],
                                          noRunReason: reason.value,
                                          notes: "",
                                          createdAt: Date.now(),
                                        });
                                      });
                                      if (newRecords.length > 0)
                                        setAttendance([
                                          ...attendance,
                                          ...newRecords,
                                        ]);
                                    }}
                                    title={`Mark all unrecorded routes as No Run`}
                                    className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold hover:bg-red-200 dark:hover:bg-red-900/50"
                                  >
                                    ✕{unrecorded}
                                  </button>
                                </>
                              )}
                              {recorded > 0 && (
                                <button
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `Clear all records for ${fmtDate(day)}?`,
                                      )
                                    )
                                      return;
                                    const toDelete = attendance.filter(
                                      (a) =>
                                        a.date === dateKey(day) &&
                                        a.month === month &&
                                        a.year === year,
                                    );
                                    const ids = toDelete.map((a) => a.id);
                                    setAttendance(
                                      attendance.filter(
                                        (a) =>
                                          !(
                                            a.date === dateKey(day) &&
                                            a.month === month &&
                                            a.year === year
                                          ),
                                      ),
                                    );
                                    await deleteAttendanceRecords(ids);
                                  }}
                                  title={`Clear all ${recorded} records for this day`}
                                  className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-semibold hover:bg-red-200 dark:hover:bg-red-900/50"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
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
                          ) : isNonOperational(day, route.id) ? (
                            <div
                              title="Non-operational day for this route"
                              className="w-full h-9 rounded-lg border text-xs font-semibold flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-default select-none"
                            >
                              —
                            </div>
                          ) : (
                            <button
                              onClick={() => openCell(day, route)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  date: day,
                                  route,
                                  att,
                                });
                              }}
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
              <div className="space-y-3">
                {Object.entries(driverTotals)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([key, data]) => {
                    const s = staff.find((x) => x.id === key);
                    const name = s?.name || data.name || key;
                    const routeEntries = Object.entries(data.routes).sort(
                      (a, b) => b[1] - a[1],
                    );
                    return (
                      <div key={key} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                              {name[0]}
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                              {name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex-shrink-0 ml-1">
                            {data.total}d
                          </span>
                        </div>
                        {routeEntries.length > 1 && (
                          <div className="pl-6 space-y-0.5">
                            {routeEntries.map(([routeNum, days]) => (
                              <div
                                key={routeNum}
                                className="flex items-center justify-between"
                              >
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                  Route {routeNum}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                  {days}d
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Colour key
            </p>
            <div className="space-y-1.5">
              {[
                { style: STATUS_STYLE.ran, label: "Ran — regular driver" },
                { style: STATUS_STYLE.cover, label: "Ran — cover driver" },
                { style: STATUS_STYLE.split, label: "Split run AM/PM" },
                { style: STATUS_STYLE.half_day, label: "Half day" },
                { style: STATUS_STYLE.no_run_orange, label: "INSET day" },
                { style: STATUS_STYLE.no_run_yellow, label: "Holiday" },
                { style: STATUS_STYLE.no_run_red, label: "No run" },
                { style: STATUS_STYLE.no_run_dark, label: "Non-operational" },
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
              <div className="space-y-2">
                <FormField label="Reason">
                  <select
                    className="input"
                    value={form.noRunReason}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, noRunReason: e.target.value }));
                      setNoRunOtherText("");
                    }}
                  >
                    <option value="">Select reason…</option>
                    {NO_RUN_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                {form.noRunReason === "other" && (
                  <FormField label="Please specify">
                    <input
                      className="input"
                      value={noRunOtherText}
                      onChange={(e) => setNoRunOtherText(e.target.value)}
                      placeholder="e.g. Child hospitalised, route suspended temporarily"
                    />
                  </FormField>
                )}
              </div>
            )}

            {/* Driver + PA */}
            {form.status !== "no_run" && (
              <>
                {/* ── Full day driver section ── */}
                {!form.isSplitRun ? (
                  <div className="space-y-3">
                    <FormGrid cols={2}>
                      {/* Driver field */}
                      <FormField
                        label="Driver"
                        hint={
                          form.isExternalDriver
                            ? "⚠ External driver"
                            : form.isCoverDriver
                              ? "⚠ Cover driver"
                              : "✓ Regular"
                        }
                      >
                        {form.isExternalDriver ? (
                          <input
                            className="input"
                            value={form.externalDriverName}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                externalDriverName: e.target.value,
                              }))
                            }
                            placeholder="Type driver name…"
                          />
                        ) : (
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
                        )}
                      </FormField>

                      {/* PA field */}
                      <FormField
                        label="PA (if applicable)"
                        hint={
                          form.isExternalPA
                            ? "⚠ External PA"
                            : form.paId && form.isCoverPA
                              ? "⚠ Cover PA"
                              : form.paId
                                ? "✓ Regular"
                                : ""
                        }
                      >
                        {form.isExternalPA ? (
                          <input
                            className="input"
                            value={form.externalPAName}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                externalPAName: e.target.value,
                              }))
                            }
                            placeholder="Type PA name…"
                          />
                        ) : (
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
                        )}
                      </FormField>
                    </FormGrid>

                    {/* External toggles */}
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isExternalDriver}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              isExternalDriver: e.target.checked,
                              externalDriverName: "",
                              driverId: e.target.checked ? "" : p.driverId,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded"
                        />
                        External / temp driver (not in staff list)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isExternalPA}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              isExternalPA: e.target.checked,
                              externalPAName: "",
                              paId: e.target.checked ? "" : p.paId,
                            }))
                          }
                          className="w-3.5 h-3.5 rounded"
                        />
                        External / temp PA
                      </label>
                    </div>

                    {/* Split run toggle */}
                    {form.status === "ran" && (
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.isSplitRun}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              isSplitRun: e.target.checked,
                              amDriverId: p.isExternalDriver ? "" : p.driverId,
                              amDriverName: p.isExternalDriver
                                ? p.externalDriverName
                                : p.driverName,
                              pmDriverId: "",
                              pmDriverName: "",
                            }))
                          }
                          className="w-4 h-4 rounded"
                        />
                        <span>
                          Split run — AM and PM done by different drivers
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          (still counts as 1 full day)
                        </span>
                      </label>
                    )}
                  </div>
                ) : (
                  /* ── Split run: AM + PM separate drivers ── */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                        Split run — full day (1) split 0.5 each between AM and
                        PM drivers in allocations
                      </div>
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline ml-3 flex-shrink-0"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            isSplitRun: false,
                            amDriverId: null,
                            amDriverName: null,
                            pmDriverId: null,
                            pmDriverName: null,
                          }))
                        }
                      >
                        Cancel split
                      </button>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 space-y-2">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        🌅 AM run — 0.5 days in allocation
                      </p>
                      <FormGrid cols={2}>
                        <FormField label="AM Driver">
                          {form.isExternalAmDriver ? (
                            <input
                              className="input"
                              value={form.amDriverName || ""}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  amDriverName: e.target.value,
                                  amDriverId: "",
                                }))
                              }
                              placeholder="Type driver name…"
                            />
                          ) : (
                            <select
                              className="input"
                              value={form.amDriverId}
                              onChange={(e) => {
                                const s = staff.find(
                                  (x) => x.id === e.target.value,
                                );
                                setForm((p) => ({
                                  ...p,
                                  amDriverId: e.target.value,
                                  amDriverName: s?.name || "",
                                }));
                              }}
                            >
                              <option value="">Select driver…</option>
                              {drivers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.isExternalAmDriver || false}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  isExternalAmDriver: e.target.checked,
                                  amDriverId: "",
                                  amDriverName: "",
                                }))
                              }
                              className="w-3 h-3 rounded"
                            />
                            External driver
                          </label>
                        </FormField>
                        <FormField label="AM PA">
                          <select
                            className="input"
                            value={form.amPaId || ""}
                            onChange={(e) => {
                              const s = staff.find(
                                (x) => x.id === e.target.value,
                              );
                              setForm((p) => ({
                                ...p,
                                amPaId: e.target.value,
                                amPaName: s?.name || "",
                              }));
                            }}
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
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800 space-y-2">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                        🌆 PM run — 0.5 days in allocation
                      </p>
                      <FormGrid cols={2}>
                        <FormField label="PM Driver">
                          {form.isExternalPmDriver ? (
                            <input
                              className="input"
                              value={form.pmDriverName || ""}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  pmDriverName: e.target.value,
                                  pmDriverId: "",
                                }))
                              }
                              placeholder="Type driver name…"
                            />
                          ) : (
                            <select
                              className="input"
                              value={form.pmDriverId}
                              onChange={(e) => {
                                const s = staff.find(
                                  (x) => x.id === e.target.value,
                                );
                                setForm((p) => ({
                                  ...p,
                                  pmDriverId: e.target.value,
                                  pmDriverName: s?.name || "",
                                }));
                              }}
                            >
                              <option value="">Select driver…</option>
                              {drivers.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.isExternalPmDriver || false}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  isExternalPmDriver: e.target.checked,
                                  pmDriverId: "",
                                  pmDriverName: "",
                                }))
                              }
                              className="w-3 h-3 rounded"
                            />
                            External driver
                          </label>
                        </FormField>
                        <FormField label="PM PA">
                          <select
                            className="input"
                            value={form.pmPaId || ""}
                            onChange={(e) => {
                              const s = staff.find(
                                (x) => x.id === e.target.value,
                              );
                              setForm((p) => ({
                                ...p,
                                pmPaId: e.target.value,
                                pmPaName: s?.name || "",
                              }));
                            }}
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
                    </div>
                  </div>
                )}

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

      {/* ── Bulk assign modal ── */}
      {showBulkAssign && bulkRoute && (
        <Modal
          title={`Bulk assign — Route ${bulkRoute.number}`}
          onClose={() => setShowBulkAssign(false)}
          size="lg"
        >
          <div className="space-y-4">
            {/* Driver + status */}
            <FormGrid cols={2}>
              <FormField label="Driver to assign *">
                <select
                  className="input"
                  value={bulkDriverId}
                  onChange={(e) => setBulkDriverId(e.target.value)}
                >
                  <option value="">Select driver…</option>
                  {drivers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.id === bulkRoute.primaryDriverId ? " (regular)" : ""}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className="input"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                >
                  <option value="ran">Ran</option>
                  <option value="no_run">Did not run</option>
                  <option value="half_day">Half day</option>
                </select>
              </FormField>
            </FormGrid>

            {bulkDriverId && bulkDriverId !== bulkRoute.primaryDriverId && (
              <div className="alert-warn text-xs text-amber-700 dark:text-amber-400">
                ⚠ This is a cover driver — all selected days will be marked as
                cover.
              </div>
            )}

            {/* Date selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="label">
                  Select days to apply ({bulkDates.length} selected)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() =>
                      setBulkDates(
                        workingDays
                          .filter(
                            (d) =>
                              !isHoliday(d, bulkRoute.id) &&
                              !isNonOperational(d, bulkRoute.id),
                          )
                          .map((d) => dateKey(d)),
                      )
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 dark:text-gray-500 hover:underline"
                    onClick={() => setBulkDates([])}
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto">
                {workingDays
                  .filter(
                    (d) =>
                      !isHoliday(d, bulkRoute.id) &&
                      !isNonOperational(d, bulkRoute.id),
                  )
                  .map((d) => {
                    const key = dateKey(d);
                    const checked = bulkDates.includes(key);
                    const current = getAtt(d, bulkRoute.id);
                    const currentDriverName = current
                      ? staff
                          .find((s) => s.id === current.driverId)
                          ?.name?.split(" ")[0] || "?"
                      : null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setBulkDates((prev) =>
                            prev.includes(key)
                              ? prev.filter((x) => x !== key)
                              : [...prev, key],
                          )
                        }
                        className={`p-2 rounded-lg border-2 text-center transition-all ${
                          checked
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300"
                        }`}
                      >
                        <div className="text-xs font-semibold">
                          {new Date(key).getDate()}
                        </div>
                        <div className="text-[9px] opacity-75">
                          {
                            ["Mon", "Tue", "Wed", "Thu", "Fri"][
                              new Date(key).getDay() - 1
                            ]
                          }
                        </div>
                        {currentDriverName && (
                          <div className="text-[8px] opacity-75 truncate">
                            {currentDriverName}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
              <p className="muted text-xs mt-2">
                Click days to toggle. Blue = will be updated. Shows current
                driver name where already recorded.
              </p>
            </div>
          </div>

          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowBulkAssign(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={saveBulkAssign}
              disabled={!bulkDriverId || bulkDates.length === 0}
            >
              Apply to {bulkDates.length} day{bulkDates.length !== 1 ? "s" : ""}
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <>
          {/* Backdrop to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 min-w-[180px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {/* Copy option — only if cell has data */}
            {contextMenu.att ? (
              <>
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => {
                    setClipboard(contextMenu.att);
                    setContextMenu(null);
                  }}
                >
                  <span>📋</span> Copy this record
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              </>
            ) : (
              <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
                No record to copy
              </div>
            )}

            {/* Paste options — only if clipboard has data */}
            {clipboard &&
              !isHoliday(contextMenu.date, contextMenu.route.id) &&
              !isNonOperational(contextMenu.date, contextMenu.route.id) && (
                <>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                    onClick={() => {
                      pasteRecord(
                        contextMenu.date,
                        contextMenu.route,
                        clipboard,
                      );
                      setContextMenu(null);
                    }}
                  >
                    <span>📌</span> Paste here
                  </button>
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 flex items-center gap-2"
                    onClick={() => {
                      // Paste to all remaining days below in this route column
                      const currentDateKey = dateKey(contextMenu.date);
                      const remainingDays = workingDays.filter((d) => {
                        if (dateKey(d) <= currentDateKey) return false;
                        if (isHoliday(d, contextMenu.route.id)) return false;
                        if (isNonOperational(d, contextMenu.route.id))
                          return false;
                        return true;
                      });
                      if (remainingDays.length === 0) {
                        alert("No more days below in this month.");
                        setContextMenu(null);
                        return;
                      }
                      if (
                        !confirm(
                          `Paste to ${remainingDays.length} remaining days in this route column?`,
                        )
                      ) {
                        setContextMenu(null);
                        return;
                      }
                      // Build all records at once
                      let updated = [...attendance];
                      remainingDays.forEach((d) => {
                        const existing = updated.find(
                          (a) =>
                            a.date === dateKey(d) &&
                            a.routeId === contextMenu.route.id,
                        );
                        const routePupils = pupils.filter(
                          (p) =>
                            p.routeId === contextMenu.route.id &&
                            p.status === "active",
                        );
                        const record = {
                          id: existing?.id || uid(),
                          month,
                          year,
                          date: dateKey(d),
                          routeId: contextMenu.route.id,
                          routeNumber: contextMenu.route.number,
                          status: clipboard.status,
                          daysValue: clipboard.daysValue ?? 1,
                          driverId: clipboard.driverId,
                          driverName: clipboard.driverName,
                          isCoverDriver: clipboard.isCoverDriver,
                          isSplitRun: clipboard.isSplitRun,
                          amDriverId: clipboard.amDriverId,
                          amDriverName: clipboard.amDriverName,
                          pmDriverId: clipboard.pmDriverId,
                          pmDriverName: clipboard.pmDriverName,
                          amPaId: clipboard.amPaId,
                          amPaName: clipboard.amPaName,
                          pmPaId: clipboard.pmPaId,
                          pmPaName: clipboard.pmPaName,
                          isExternalDriver: clipboard.isExternalDriver,
                          externalDriverName: clipboard.externalDriverName,
                          isExternalPA: clipboard.isExternalPA,
                          externalPAName: clipboard.externalPAName,
                          paId: clipboard.paId,
                          paName: clipboard.paName,
                          isCoverPA: clipboard.isCoverPA,
                          noRunReason: clipboard.noRunReason,
                          notes: clipboard.notes,
                          childrenAttendance:
                            existing?.childrenAttendance ||
                            routePupils.map((p) => ({
                              childId: p.id,
                              name: `${p.firstName} ${p.lastName}`,
                              attended: true,
                              absenceReason: "",
                            })),
                          createdAt: existing?.createdAt || Date.now(),
                        };
                        if (existing) {
                          updated = updated.map((a) =>
                            a.id === existing.id ? record : a,
                          );
                        } else {
                          updated.push(record);
                        }
                      });
                      setAttendance(updated);
                      setContextMenu(null);
                    }}
                  >
                    <span>⬇</span> Paste to all days below
                  </button>
                </>
              )}

            {/* Clipboard status */}
            {clipboard && (
              <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700 mt-1">
                Clipboard:{" "}
                {clipboard.isExternalDriver
                  ? clipboard.externalDriverName
                  : clipboard.driverName?.split(" ")[0]}{" "}
                — {clipboard.status}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
