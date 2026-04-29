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

const HOLIDAY_TYPES = [
  { value: "bank_holiday", label: "Bank holiday", color: "chip-blue" },
  { value: "school_holiday", label: "School holiday", color: "chip-green" },
  { value: "inset_day", label: "INSET day", color: "chip-amber" },
];

const TYPE_STYLE = {
  bank_holiday:
    "bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-400   border-blue-200   dark:border-blue-800",
  school_holiday:
    "bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-400  border-green-200  dark:border-green-800",
  inset_day:
    "bg-amber-50  dark:bg-amber-900/20  text-amber-700  dark:text-amber-400  border-amber-200  dark:border-amber-800",
};

// UK bank holidays 2025-2027 pre-loaded
const UK_BANK_HOLIDAYS = [
  { date: "2025-01-01", label: "New Year's Day" },
  { date: "2025-04-18", label: "Good Friday" },
  { date: "2025-04-21", label: "Easter Monday" },
  { date: "2025-05-05", label: "Early May bank holiday" },
  { date: "2025-05-26", label: "Spring bank holiday" },
  { date: "2025-08-25", label: "Summer bank holiday" },
  { date: "2025-12-25", label: "Christmas Day" },
  { date: "2025-12-26", label: "Boxing Day" },
  { date: "2026-01-01", label: "New Year's Day" },
  { date: "2026-04-03", label: "Good Friday" },
  { date: "2026-04-06", label: "Easter Monday" },
  { date: "2026-05-04", label: "Early May bank holiday" },
  { date: "2026-05-25", label: "Spring bank holiday" },
  { date: "2026-08-31", label: "Summer bank holiday" },
  { date: "2026-12-25", label: "Christmas Day" },
  { date: "2026-12-28", label: "Boxing Day (substitute)" },
  { date: "2027-01-01", label: "New Year's Day" },
  { date: "2027-03-26", label: "Good Friday" },
  { date: "2027-03-29", label: "Easter Monday" },
  { date: "2027-05-03", label: "Early May bank holiday" },
  { date: "2027-05-31", label: "Spring bank holiday" },
  { date: "2027-08-30", label: "Summer bank holiday" },
  { date: "2027-12-27", label: "Christmas Day (substitute)" },
  { date: "2027-12-28", label: "Boxing Day (substitute)" },
];

function getWorkingDays(month, year) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({ date: key, dayNum: d.getDate(), dow });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];

const EMPTY = {
  date: "",
  label: "",
  type: "inset_day",
  allRoutes: true,
  routeIds: [],
  isRange: false,
  dateFrom: "",
  dateTo: "",
};

export default function HolidayCalendar() {
  const { holidays, setHolidays, routes } = useApp();

  const [month, setMonth] = useState(() => {
    const s = localStorage.getItem("hol_month");
    return s !== null ? parseInt(s) : currentMonth();
  });
  const [year, setYear] = useState(() => {
    const s = localStorage.getItem("hol_year");
    return s !== null ? parseInt(s) : currentYear();
  });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const workingDays = getWorkingDays(month, year);

  // Index holidays by date for fast lookup
  const holidayIndex = useMemo(() => {
    const idx = {};
    holidays.forEach((h) => {
      if (!idx[h.date]) idx[h.date] = [];
      idx[h.date].push(h);
    });
    return idx;
  }, [holidays]);

  const monthHolidays = holidays
    .filter((h) => h.month === month && h.year === year)
    .sort((a, b) => a.date.localeCompare(b.date));

  const workingDaysCount = workingDays.filter(
    (d) => !holidayIndex[d.date],
  ).length;

  const openAdd = (date = "") => {
    setForm({ ...EMPTY, date, month, year });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (h) => {
    setForm({ ...h, routeIds: h.routeIds || [] });
    setEditing(h);
    setShowModal(true);
  };

  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.label) return;
    const allRoutes = form.allRoutes === true || form.allRoutes === "true";

    if (form.isRange && !editing) {
      // Range mode — create one record per working day in range
      if (!form.dateFrom || !form.dateTo) return;
      const from = new Date(form.dateFrom);
      const to = new Date(form.dateTo);
      if (to < from) {
        alert("End date must be after start date");
        return;
      }
      const newRecords = [];
      const cur = new Date(from);
      while (cur <= to) {
        const dow = cur.getDay();
        if (dow >= 1 && dow <= 5) {
          // Mon-Fri only
          const dateStr = cur.toISOString().split("T")[0];
          const alreadyExists = holidays.some((h) => h.date === dateStr);
          if (!alreadyExists) {
            const [y, m] = dateStr.split("-");
            newRecords.push({
              id: uid(),
              date: dateStr,
              label: form.label,
              type: form.type,
              allRoutes,
              routeIds: form.routeIds || [],
              month: parseInt(m) - 1,
              year: parseInt(y),
              createdAt: Date.now(),
            });
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (newRecords.length === 0) {
        alert("No new working days found in that range.");
        return;
      }
      if (
        confirm(
          `Add ${newRecords.length} non-working day${newRecords.length !== 1 ? "s" : ""} (${form.dateFrom} to ${form.dateTo})?`,
        )
      ) {
        setHolidays([...holidays, ...newRecords]);
        close();
      }
      return;
    }

    // Single day mode
    if (!form.date) return;
    const [y, m] = form.date.split("-");
    const record = {
      id: editing?.id || uid(),
      date: form.date,
      label: form.label,
      type: form.type,
      allRoutes,
      routeIds: form.routeIds || [],
      month: parseInt(m) - 1,
      year: parseInt(y),
      createdAt: editing?.createdAt || Date.now(),
    };
    setHolidays(
      editing
        ? holidays.map((h) => (h.id === editing.id ? record : h))
        : [...holidays, record],
    );
    close();
  };

  const del = (id) => {
    if (confirm("Remove this holiday?"))
      setHolidays(holidays.filter((h) => h.id !== id));
  };

  // Import UK bank holidays for the year
  const importBankHolidays = () => {
    const toImport = UK_BANK_HOLIDAYS.filter((bh) => {
      const [y] = bh.date.split("-");
      if (parseInt(y) !== year) return false;
      return !holidays.some(
        (h) => h.date === bh.date && h.type === "bank_holiday",
      );
    });
    if (toImport.length === 0) {
      alert(`All ${year} UK bank holidays already imported.`);
      return;
    }
    const newHols = toImport.map((bh) => {
      const [y, m] = bh.date.split("-");
      return {
        id: uid(),
        date: bh.date,
        label: bh.label,
        type: "bank_holiday",
        allRoutes: true,
        routeIds: [],
        month: parseInt(m) - 1,
        year: parseInt(y),
        createdAt: Date.now(),
      };
    });
    setHolidays([...holidays, ...newHols]);
    alert(`Imported ${newHols.length} bank holidays for ${year}.`);
  };

  // Toggle route in selection
  const toggleRoute = (routeId) => {
    setForm((p) => ({
      ...p,
      routeIds: p.routeIds.includes(routeId)
        ? p.routeIds.filter((id) => id !== routeId)
        : [...p.routeIds, routeId],
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="School Holiday Calendar"
        subtitle="Mark non-working days — used by attendance register and invoice validation"
        actions={
          <div className="flex gap-2">
            <select
              className="input w-36"
              value={month}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMonth(v);
                localStorage.setItem("hol_month", v);
              }}
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
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(v);
                localStorage.setItem("hol_year", v);
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
              onClick={importBankHolidays}
            >
              Import bank holidays
            </button>
            <button className="btn-primary" onClick={() => openAdd()}>
              + Add holiday
            </button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Calendar grid ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-3">
            <div className="metric">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Working days
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {workingDaysCount}
              </p>
              <p className="muted mt-0.5">
                {MONTHS_SHORT[month]} {year}
              </p>
            </div>
            <div className="metric">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Non-working days
              </p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {workingDays.length - workingDaysCount}
              </p>
              <p className="muted mt-0.5">this month</p>
            </div>
            <div className="metric">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Bank holidays
              </p>
              <p className="text-2xl font-semibold text-blue-700 dark:text-blue-400">
                {monthHolidays.filter((h) => h.type === "bank_holiday").length}
              </p>
              <p className="muted mt-0.5">this month</p>
            </div>
            <div className="metric">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                INSET / school
              </p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {monthHolidays.filter((h) => h.type !== "bank_holiday").length}
              </p>
              <p className="muted mt-0.5">this month</p>
            </div>
          </div>

          {/* Calendar */}
          <div className="card overflow-hidden">
            <div className="card-section">
              <h3 className="section-title">
                {MONTHS[month]} {year} — Working days
              </h3>
            </div>
            <div className="p-4 grid grid-cols-5 gap-2">
              {/* Day headers */}
              {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 pb-1"
                >
                  {d}
                </div>
              ))}

              {/* Offset — find what day of week the month starts on */}
              {Array.from({ length: workingDays[0]?.dow - 1 || 0 }).map(
                (_, i) => (
                  <div key={`offset-${i}`} />
                ),
              )}

              {/* Day cells */}
              {workingDays.map((d) => {
                const dayHols = holidayIndex[d.date] || [];
                const isHol = dayHols.length > 0;
                const type = dayHols[0]?.type || "";
                return (
                  <button
                    key={d.date}
                    onClick={() =>
                      isHol ? openEdit(dayHols[0]) : openAdd(d.date)
                    }
                    className={`relative p-2 rounded-xl border-2 text-center transition-all hover:opacity-80 ${
                      isHol
                        ? TYPE_STYLE[type] || TYPE_STYLE.school_holiday
                        : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                  >
                    <div className="text-lg font-bold">{d.dayNum}</div>
                    <div className="text-[10px] font-medium truncate">
                      {isHol ? dayHols[0].label : DOW[d.dow]}
                    </div>
                    {dayHols.length > 1 && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white dark:bg-gray-800 rounded-full text-[9px] font-bold flex items-center justify-center text-gray-600 dark:text-gray-400">
                        +{dayHols.length - 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="px-4 pb-4 flex items-center gap-4 flex-wrap">
              {HOLIDAY_TYPES.map((t) => (
                <div key={t.value} className="flex items-center gap-1.5">
                  <div
                    className={`w-3 h-3 rounded border ${TYPE_STYLE[t.value]}`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t.label}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded border bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Working day (click to add holiday)
                </span>
              </div>
            </div>
          </div>

          {/* List view */}
          {monthHolidays.length === 0 ? (
            <EmptyState
              icon="📅"
              title={`No holidays recorded for ${MONTHS[month]} ${year}`}
              description="Click any day in the calendar above to add a holiday, or use Import bank holidays to add UK bank holidays automatically."
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="card-section">
                <h3 className="section-title">
                  Non-working days — {MONTHS_SHORT[month]} {year}
                </h3>
              </div>
              <table className="min-w-full">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Date</th>
                    <th className="th">Description</th>
                    <th className="th">Type</th>
                    <th className="th">Applies to</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {monthHolidays.map((h) => (
                    <tr key={h.id} className="tr">
                      <td className="td font-medium text-gray-900 dark:text-gray-100">
                        {new Date(h.date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="td text-gray-700 dark:text-gray-300">
                        {h.label}
                      </td>
                      <td className="td">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
                            h.type === "bank_holiday"
                              ? "bg-blue-50  dark:bg-blue-900/30  text-blue-700  dark:text-blue-400  ring-blue-200  dark:ring-blue-800"
                              : h.type === "inset_day"
                                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-amber-200 dark:ring-amber-800"
                                : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-200 dark:ring-green-800"
                          }`}
                        >
                          {HOLIDAY_TYPES.find((t) => t.value === h.type)
                            ?.label || h.type}
                        </span>
                      </td>
                      <td className="td text-gray-500 dark:text-gray-400 text-sm">
                        {h.allRoutes
                          ? "All routes"
                          : `${h.routeIds?.length || 0} specific route${h.routeIds?.length !== 1 ? "s" : ""}`}
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost"
                            onClick={() => openEdit(h)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => del(h.id)}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right panel: year overview ── */}
        <div className="w-52 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {year} — monthly working days
            </p>
            <div className="space-y-1.5">
              {MONTHS_SHORT.map((m, i) => {
                const wd = getWorkingDays(i, year);
                const hols = holidays.filter(
                  (h) => h.month === i && h.year === year,
                );
                const working = wd.length - hols.length;
                const isCurrentMonth = i === month;
                return (
                  <button
                    key={i}
                    onClick={() => setMonth(i)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isCurrentMonth
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="font-medium">{m}</span>
                    <div className="flex items-center gap-2">
                      {hols.length > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {hols.length}h
                        </span>
                      )}
                      <span
                        className={`font-semibold ${isCurrentMonth ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-gray-100"}`}
                      >
                        {working}d
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <Modal
          title={editing ? "Edit holiday" : "Add non-working day"}
          onClose={close}
          size="md"
        >
          <div className="space-y-4">
            {/* Single / Range toggle — only for new records */}
            {!editing && (
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isRange: false }))}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${!form.isRange ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
                >
                  Single day
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isRange: true }))}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${form.isRange ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
                >
                  Date range
                </button>
              </div>
            )}

            <FormGrid cols={2}>
              {form.isRange && !editing ? (
                <>
                  <FormField label="From date *">
                    <input
                      className="input"
                      type="date"
                      value={form.dateFrom}
                      onChange={f("dateFrom")}
                    />
                  </FormField>
                  <FormField label="To date *">
                    <input
                      className="input"
                      type="date"
                      value={form.dateTo}
                      onChange={f("dateTo")}
                    />
                  </FormField>
                </>
              ) : (
                <FormField label="Date *">
                  <input
                    className="input"
                    type="date"
                    value={form.date}
                    onChange={f("date")}
                  />
                </FormField>
              )}
              <FormField label="Type">
                <select
                  className="input"
                  value={form.type}
                  onChange={f("type")}
                >
                  {HOLIDAY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            <FormField label="Description *">
              <input
                className="input"
                value={form.label}
                onChange={f("label")}
                placeholder="e.g. Easter Monday, INSET Day — Philpots Manor"
              />
            </FormField>

            <FormField label="Applies to">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={
                      form.allRoutes === true || form.allRoutes === "true"
                    }
                    onChange={() =>
                      setForm((p) => ({ ...p, allRoutes: true, routeIds: [] }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    All routes (school-wide closure)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={
                      form.allRoutes === false || form.allRoutes === "false"
                    }
                    onChange={() =>
                      setForm((p) => ({ ...p, allRoutes: false }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Specific routes only (e.g. one school has INSET)
                  </span>
                </label>
              </div>
            </FormField>

            {(form.allRoutes === false || form.allRoutes === "false") && (
              <FormField label="Select routes">
                {/* School quick-select */}
                {(() => {
                  const schools = [
                    ...new Set(
                      routes
                        .filter((r) => r.active && r.school)
                        .map((r) => r.school),
                    ),
                  ].sort();
                  if (schools.length === 0) return null;
                  return (
                    <div className="mb-2 space-y-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                        Quick select by school:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {schools.map((school) => {
                          const schoolRoutes = routes.filter(
                            (r) => r.active && r.school === school,
                          );
                          const allSelected = schoolRoutes.every((r) =>
                            form.routeIds?.includes(r.id),
                          );
                          return (
                            <button
                              key={school}
                              type="button"
                              onClick={() => {
                                const schoolIds = schoolRoutes.map((r) => r.id);
                                if (allSelected) {
                                  setForm((p) => ({
                                    ...p,
                                    routeIds: p.routeIds.filter(
                                      (id) => !schoolIds.includes(id),
                                    ),
                                  }));
                                } else {
                                  setForm((p) => ({
                                    ...p,
                                    routeIds: [
                                      ...new Set([
                                        ...(p.routeIds || []),
                                        ...schoolIds,
                                      ]),
                                    ],
                                  }));
                                }
                              }}
                              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                                allSelected
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400"
                              }`}
                            >
                              {school} ({schoolRoutes.length})
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              routeIds: routes
                                .filter((r) => r.active)
                                .map((r) => r.id),
                            }))
                          }
                          className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({ ...p, routeIds: [] }))
                          }
                          className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-400"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {/* Individual route list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                  {routes
                    .filter((r) => r.active)
                    .map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={form.routeIds?.includes(r.id)}
                          onChange={() => toggleRoute(r.id)}
                          className="w-4 h-4 rounded"
                        />
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            Route {r.number} — {r.name}
                          </span>
                          {r.school && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                              {r.school}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                </div>
                {form.routeIds?.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {form.routeIds.length} route
                    {form.routeIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </FormField>
            )}
          </div>

          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={save}
              disabled={
                !form.label ||
                (form.isRange && !editing
                  ? !form.dateFrom || !form.dateTo
                  : !form.date)
              }
            >
              Save
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
// file name changed to HolidayCalendar.jsx to match component name and avoid confusion with the folder name. Please update the import in App.jsx accordingly.
