import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { toast } from "sonner";
import { useConfirm } from "../context/ConfirmContext";
import {
  uid,
  fmt,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
  cleanNum,
  getAllocTotalCost,
} from "../lib/utils";

// const cleanNum = (n) =>
//   String(n || "")
//     .replace(/^route\s+/i, "")
//     .trim();

const EMPTY = {
  routeId: "",
  month: currentMonth(),
  year: currentYear(),
  totalDays: "",
  regularStaffId: "",
  regularDays: "",
  regularRate: "",
  coverEntries: [],
  absenceReason: "",
  notes: "",
  paStaffId: "",
  paStaffName: "",
  paDays: "",
  paRate: "",
  regularAmount: 0,
  additiveEntries: [],
  hasRateSplit: false,
};

export default function Allocations() {
  const { allocations, setAllocations, routes, staff, invoices, attendance } =
    useApp();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [monthF, setMonthF] = useState(() => {
    const s = localStorage.getItem("alloc_month");
    return s !== null ? parseInt(s) : currentMonth();
  });
  const [yearF, setYearF] = useState(() => {
    const s = localStorage.getItem("alloc_year");
    return s !== null ? parseInt(s) : currentYear();
  });

  const showConfirm = useConfirm();

  const drivers = staff.filter(
    (s) => s.type === "driver" || s.type === "driver_pa",
  );

  const getAttendanceSplit = (routeId, month, year) => {
    const route = routes.find((r) => r.id === routeId);
    const opDays = route?.operationalDays || [1, 2, 3, 4, 5];
    const records = attendance.filter((a) => {
      if (
        a.routeId !== routeId ||
        a.month !== month ||
        a.year !== year ||
        a.status === "no_run"
      )
        return false;
      const dow = new Date(a.date).getDay();
      return opDays.includes(dow);
    });
    const byDriver = {};
    records.forEach((a) => {
      if (a.isSplitRun) {
        const amKey = a.amDriverId || a.amDriverName || null;
        const pmKey = a.pmDriverId || a.pmDriverName || null;
        if (amKey) {
          if (!byDriver[amKey])
            byDriver[amKey] = { name: a.amDriverName || "", days: 0 };
          byDriver[amKey].days += 0.5;
        }
        if (pmKey && pmKey !== amKey) {
          if (!byDriver[pmKey])
            byDriver[pmKey] = { name: a.pmDriverName || "", days: 0 };
          byDriver[pmKey].days += 0.5;
        } else if (amKey && !pmKey) {
          byDriver[amKey].days += 0.5;
        }
        return;
      }
      const key =
        a.driverId ||
        (a.isExternalDriver ? a.externalDriverName : null) ||
        a.driverName ||
        null;
      if (!key) return;
      if (!byDriver[key])
        byDriver[key] = {
          name: a.isExternalDriver ? a.externalDriverName : a.driverName || "",
          days: 0,
        };
      byDriver[key].days += a.daysValue ?? 1;
    });
    return byDriver;
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const getStaffName = (id) => staff.find((s) => s.id === id)?.name || "—";
  const getRoute = (id) => routes.find((r) => r.id === id);

  // Auto-fill rate when regular staff selected
  const handleRegularStaffChange = (e) => {
    const staffId = e.target.value;
    const route = getRoute(form.routeId);
    setForm((p) => ({
      ...p,
      regularStaffId: staffId,
      regularRate: route?.driverDailyRate || "",
    }));
  };

  // Auto-fill route details when route selected
  const handleRouteChange = (e) => {
    const routeId = e.target.value;
    const route = routes.find((r) => r.id === routeId);
    const inv = invoices.find(
      (x) =>
        cleanNum(x.routeNumber) === cleanNum(route?.number) &&
        x.month === Number(form.month) &&
        x.year === Number(form.year),
    );
    // Try to get driver split from attendance register
    const split = getAttendanceSplit(
      routeId,
      Number(form.month),
      Number(form.year),
    );
    const splitArr = Object.entries(split).sort(
      (a, b) => b[1].days - a[1].days,
    );
    // Regular driver = most days in attendance
    const primary = splitArr[0];
    // Cover driver = second most (if different from regular)
    const cover = splitArr[1];
    const totalDays =
      inv?.daysWorked ||
      Object.values(split).reduce((s, v) => s + v.days, 0) ||
      "";

    const regularRate = route?.driverDailyRate || 0;
    const primaryId = route?.primaryDriverId;
    const primaryEntry = primaryId
      ? splitArr.find(([id]) => id === primaryId) || splitArr[0]
      : splitArr[0];
    const coverArr = splitArr.filter(([id]) => id !== primaryEntry?.[0]);
    const coverEntries = coverArr.map(([id, data]) => {
      const s = staff.find((x) => x.id === id);
      return {
        id: uid(),
        staffId: id || "",
        staffName: data.name || s?.name || "",
        days: data.days,
        rate: regularRate,
        amount: Math.round(data.days * regularRate * 100) / 100,
        isExternal: false,
      };
    });
    const primaryPA = staff.find((x) => x.id === route?.primaryPAId);
    const additiveBands = (route?.rateBands || []).filter((b) => b.isAdditive);
    const undatedReplacementBands = (route?.rateBands || []).filter(
      (b) => !b.isAdditive && !b.effectiveFrom,
    );
    const hasUndatedReplacement = undatedReplacementBands.length > 0;
    const primaryDriverId = primaryEntry ? primaryEntry[0] : "";
    const primaryDriverName = primaryEntry
      ? staff.find((x) => x.id === primaryEntry[0])?.name ||
        primaryEntry[1]?.name ||
        ""
      : "";
    const additiveEntries = additiveBands.map((b) => ({
      id: uid(),
      bandId: b.id,
      description: b.description,
      staffId: primaryDriverId,
      staffName: primaryDriverName,
      days: "",
      rate: b.driverRate ? String(b.driverRate) : "",
      amount: 0,
    }));
    setForm((p) => ({
      ...p,
      routeId,
      totalDays,
      regularRate,
      regularStaffId: primaryEntry ? primaryEntry[0] : p.regularStaffId,
      regularDays: primaryEntry ? primaryEntry[1].days : "",
      coverEntries,
      paStaffId: route?.primaryPAId || "",
      paStaffName: primaryPA?.name || "",
      paRate: route?.paPayRate ? String(route.paPayRate) : "",
      paDays: totalDays ? String(totalDays) : "",
      additiveEntries,
      hasRateSplit: hasUndatedReplacement,
      notes: hasUndatedReplacement
        ? `Day-specific rate split: ${undatedReplacementBands.map((b) => `"${b.description}" £${b.driverRate}/day`).join(", ")}. Adjust owed amount manually.`
        : p.notes,
    }));
  };

  const openAdd = () => {
    setForm({ ...EMPTY, month: monthF, year: yearF });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (a) => {
    const coverEntries =
      a.coverEntries?.length > 0
        ? a.coverEntries
        : a.tempStaffId || a.tempStaffName
          ? [
              {
                id: uid(),
                staffId: a.tempStaffId || "",
                staffName: a.tempStaffName || "",
                days: a.tempDays || 0,
                rate: a.tempRate || 0,
                amount: a.tempAmount || 0,
                isExternal: false,
              },
            ]
          : [];
    setForm({
      routeId: a.routeId,
      month: a.month,
      year: a.year,
      totalDays: a.totalDays,
      regularStaffId: a.regularStaffId,
      regularDays: a.regularDays,
      regularRate: a.regularRate,
      coverEntries,
      absenceReason: a.absenceReason || "",
      notes: a.notes || "",
      paStaffId: a.paStaffId || "",
      paStaffName: a.paStaffName || "",
      paDays: a.paDays || "",
      paRate: a.paRate || "",
      regularAmount: a.regularAmount || 0,
      hasRateSplit: a.hasRateSplit || false,
      additiveEntries: (() => {
        if (a.additiveEntries?.length > 0) return a.additiveEntries;
        const route = routes.find((r) => r.id === a.routeId);
        const additiveBands = (route?.rateBands || []).filter(
          (b) => b.isAdditive,
        );
        return additiveBands.map((b) => ({
          id: uid(),
          bandId: b.id,
          description: b.description,
          staffId: a.regularStaffId || "",
          staffName: staff.find((s) => s.id === a.regularStaffId)?.name || "",
          days: "",
          rate: b.driverRate ? String(b.driverRate) : "",
          amount: 0,
        }));
      })(),
    });
    setEditing(a);
    setShowModal(true);
  };

  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.routeId || !form.regularStaffId || !form.totalDays) return;
    const route = getRoute(form.routeId);
    const regularDays = Number(form.regularDays) || 0;
    const regularRate = Number(form.regularRate) || 0;
    const calculatedAmount = Math.round(regularDays * regularRate * 100) / 100;
    const regularAmount =
      form.hasRateSplit && form.regularAmount
        ? form.regularAmount
        : calculatedAmount;
    const coverEntries = (form.coverEntries || []).map((c) => ({
      ...c,
      days: Number(c.days) || 0,
      rate: Number(c.rate) || 0,
      amount:
        Math.round((Number(c.days) || 0) * (Number(c.rate) || 0) * 100) / 100,
    }));
    const first = coverEntries[0];
    const tempDays = first ? Number(first.days) || 0 : 0;
    const tempRate = first ? Number(first.rate) || 0 : 0;
    const tempAmount = first ? Number(first.amount) || 0 : 0;

    const paDays = Number(form.paDays) || 0;
    const paRate = Number(form.paRate) || 0;
    const paAmount = Math.round(paDays * paRate * 100) / 100;

    const additiveEntries = (form.additiveEntries || [])
      .map((e) => ({
        ...e,
        days: Number(e.days) || 0,
        rate: Number(e.rate) || 0,
        amount:
          Math.round((Number(e.days) || 0) * (Number(e.rate) || 0) * 100) / 100,
      }))
      .filter((e) => e.days > 0);

    const record = {
      id: editing?.id || uid(),
      routeId: form.routeId,
      routeNumber: route?.number || "",
      routeName: route?.name || "",
      month: Number(form.month),
      year: Number(form.year),
      totalDays: Number(form.totalDays),
      regularStaffId: form.regularStaffId,
      regularDays,
      regularRate,
      regularAmount,
      tempStaffId: first?.staffId || null,
      tempStaffName: first?.staffName || "",
      tempDays,
      tempRate,
      tempAmount,
      coverEntries,
      absenceReason: form.absenceReason || "",
      notes: form.notes || "",
      paStaffId: form.paStaffId || null,
      paStaffName: form.paStaffName || "",
      paDays,
      paRate,
      paAmount,
      additiveEntries,
      hasRateSplit: form.hasRateSplit || false,
      createdAt: editing?.createdAt || Date.now(),
    };

    setAllocations(
      editing
        ? allocations.map((a) => (a.id === editing.id ? record : a))
        : [...allocations, record],
    );
    toast.success(editing ? "Allocation updated." : "Allocation created.");
    close();
  };

  const del = async (id) => {
    const alloc = allocations.find((a) => a.id === id);
    const confirmed = await showConfirm({
      title: "Delete this allocation?",
      message: `Route ${cleanNum(alloc?.routeNumber || "")} — ${MONTHS[alloc?.month]} ${alloc?.year}. This cannot be undone.`,
      type: "danger",
      confirmLabel: "Delete",
    });
    if (confirmed) {
      setAllocations(allocations.filter((a) => a.id !== id));
      toast.success("Allocation deleted.");
    }
  };

  // Filter by month/year
  const filtered = allocations
    .filter((a) => a.month === monthF && a.year === yearF)
    .sort((a, b) => {
      const ai = routes.findIndex((r) => r.id === a.routeId);
      const bi = routes.findIndex((r) => r.id === b.routeId);
      return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
    });

  // Month totals
  const totalRegular = filtered.reduce((s, a) => s + (a.regularAmount || 0), 0);
  const totalTemp = filtered.reduce((s, a) => s + (a.tempAmount || 0), 0);
  const totalOwed = filtered.reduce((s, a) => s + getAllocTotalCost(a), 0);

  // Days check — warn if allocation days don't match invoice days
  const getDaysWarning = (a) => {
    const inv = invoices.find(
      (x) =>
        cleanNum(x.routeNumber) === cleanNum(a.routeNumber) &&
        x.month === a.month &&
        x.year === a.year,
    );
    if (!inv) return null;
    const coverTotal =
      a.coverEntries?.length > 0
        ? a.coverEntries.reduce((s, c) => s + (Number(c.days) || 0), 0)
        : Number(a.tempDays) || 0;
    const allocTotal = (Number(a.regularDays) || 0) + coverTotal;
    if (allocTotal !== a.totalDays)
      return `Days split (${allocTotal}) doesn't match total (${a.totalDays})`;
    if (inv.daysWorked && Number(inv.daysWorked) !== a.totalDays)
      return `Invoice has ${inv.daysWorked} days but allocation has ${a.totalDays}`;
    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Allocations"
        subtitle="Monthly route coverage — who worked what and what they're owed"
        actions={
          <button className="btn-primary" onClick={openAdd}>
            + Add allocation
          </button>
        }
      />

      {/* Filters */}
      <div className="toolbar">
        <select
          className="input w-36"
          value={monthF}
          onChange={(e) => {
            const v = Number(e.target.value);
            setMonthF(v);
            localStorage.setItem("alloc_month", v);
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
          value={yearF}
          onChange={(e) => {
            const v = Number(e.target.value);
            setYearF(v);
            localStorage.setItem("alloc_year", v);
          }}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {filtered.length > 0 && (
          <div className="ml-auto flex items-center gap-6 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              Regular staff:{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {fmt(totalRegular)}
              </span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Temp staff:{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {fmt(totalTemp)}
              </span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              Total owed:{" "}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {fmt(totalOwed)}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="page-body !space-y-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            title={`No allocations for ${MONTHS[monthF]} ${yearF}`}
            description="Add an allocation for each route to track who worked what days and what they're owed."
            action={
              <button className="btn-primary" onClick={openAdd}>
                Add first allocation
              </button>
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Route</th>
                    <th className="th">Regular staff</th>
                    <th className="th-r">Days</th>
                    <th className="th-r">Rate</th>
                    <th className="th-r">Owed</th>
                    <th className="th" colSpan={3}>
                      Cover drivers
                    </th>
                    <th className="th-r">Extras</th>
                    <th className="th-r">PA owed</th>
                    <th className="th-r">Total owed</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((a) => {
                    const warning = getDaysWarning(a);
                    return (
                      <tr key={a.id} className="tr">
                        <td className="td">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            Route {a.routeNumber.replace(/^route\s+/i, "")}
                          </p>
                          <p className="muted">{a.routeName}</p>
                          {warning && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              ⚠ {warning}
                            </p>
                          )}
                        </td>
                        <td className="td">
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {getStaffName(a.regularStaffId)}
                          </p>
                          <p className="muted">{a.totalDays} total days</p>
                          {a.absenceReason && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                              📋 {a.absenceReason}
                            </p>
                          )}
                        </td>
                        <td className="td-r text-gray-700 dark:text-gray-300">
                          {a.regularDays}
                        </td>
                        <td className="td-r text-gray-500 dark:text-gray-400">
                          {fmt(a.regularRate)}
                          {Math.abs(
                            a.regularDays * a.regularRate - a.regularAmount,
                          ) > 0.01 && (
                            <span className="text-[10px] text-blue-500 dark:text-blue-400 ml-1">
                              split
                            </span>
                          )}
                        </td>
                        <td className="td-r font-medium text-gray-900 dark:text-gray-100">
                          {fmt(a.regularAmount)}
                        </td>
                        <td className="td" colSpan={3}>
                          {(() => {
                            const entries =
                              a.coverEntries?.length > 0
                                ? a.coverEntries
                                : a.tempDays > 0
                                  ? [
                                      {
                                        staffId: a.tempStaffId,
                                        staffName: a.tempStaffName,
                                        days: a.tempDays,
                                        rate: a.tempRate,
                                        amount: a.tempAmount,
                                      },
                                    ]
                                  : [];
                            if (entries.length === 0)
                              return <span className="muted">—</span>;
                            return (
                              <div className="space-y-1">
                                {entries.map((c, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <span className="text-gray-700 dark:text-gray-300 font-medium min-w-0 truncate">
                                      {c.staffName || getStaffName(c.staffId)}
                                    </span>
                                    <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                                      {c.days}d × {fmt(c.rate)}
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium flex-shrink-0">
                                      {fmt(c.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="td-r text-gray-700 dark:text-gray-300">
                          {(() => {
                            const entries = (a.additiveEntries || []).filter(
                              (e) => Number(e.amount) > 0,
                            );
                            const total = entries.reduce(
                              (s, e) => s + (Number(e.amount) || 0),
                              0,
                            );
                            return total > 0 ? (
                              <div>
                                <div className="font-medium">{fmt(total)}</div>
                                {entries.map((e, i) => (
                                  <div
                                    key={i}
                                    className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[80px]"
                                  >
                                    {e.description}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="muted">—</span>
                            );
                          })()}
                        </td>
                        <td className="td-r text-gray-700 dark:text-gray-300">
                          {a.paAmount > 0 ? (
                            fmt(a.paAmount)
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="td-r font-semibold text-green-700 dark:text-green-400">
                          {fmt(getAllocTotalCost(a))}
                        </td>
                        <td className="td">
                          <div className="flex gap-1">
                            <button
                              className="btn-ghost"
                              onClick={() => openEdit(a)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => del(a.id)}
                            >
                              Del
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="tfoot-row">
                    <td
                      className="td font-bold text-gray-900 dark:text-gray-100"
                      colSpan={4}
                    >
                      Total
                    </td>
                    <td className="td-r font-semibold">{fmt(totalRegular)}</td>
                    <td colSpan={3} />
                    <td />
                    <td />
                    <td className="td-r font-bold text-green-700 dark:text-green-400">
                      {fmt(totalOwed)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? "Edit allocation" : "Add allocation"}
          onClose={close}
          size="lg"
        >
          <div className="space-y-4">
            <FormGrid cols={3}>
              <FormField label="Route *">
                <select
                  className="input"
                  value={form.routeId}
                  onChange={handleRouteChange}
                >
                  <option value="">Select route…</option>
                  {routes
                    .filter((r) => r.active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Route {r.number.replace(/^route\s+/i, "")} — {r.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label="Month">
                <select
                  className="input"
                  value={form.month}
                  onChange={f("month")}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Year">
                <select
                  className="input"
                  value={form.year}
                  onChange={f("year")}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>

            <FormField
              label="Total days invoiced"
              hint="Must match the invoice for this route"
            >
              <div className="flex items-center gap-3">
                <input
                  className="input w-32"
                  type="number"
                  min="0"
                  value={form.totalDays}
                  onChange={f("totalDays")}
                  placeholder="22"
                />
                {form.routeId &&
                  (() => {
                    const split = getAttendanceSplit(
                      form.routeId,
                      Number(form.month),
                      Number(form.year),
                    );
                    const total = Object.values(split).reduce(
                      (s, v) => s + v.days,
                      0,
                    );
                    return total > 0 ? (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        📋 {total} days in attendance register
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        No attendance records for this period
                      </span>
                    );
                  })()}
              </div>
            </FormField>

            {/* Regular staff */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">Regular staff</p>
              <FormGrid cols={3}>
                <FormField label="Staff member *">
                  <select
                    className="input"
                    value={form.regularStaffId}
                    onChange={handleRegularStaffChange}
                  >
                    <option value="">Select…</option>
                    {drivers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Days worked">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.regularDays}
                    onChange={f("regularDays")}
                    placeholder="0"
                  />
                </FormField>
                <FormField label="Rate (£/day)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.regularRate}
                    onChange={f("regularRate")}
                    placeholder="90.00"
                  />
                </FormField>
              </FormGrid>
              {form.regularDays && form.regularRate && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Regular owed:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(
                      form.regularAmount &&
                        Math.abs(
                          form.regularAmount -
                            Number(form.regularDays) * Number(form.regularRate),
                        ) > 0.01
                        ? form.regularAmount
                        : Number(form.regularDays) * Number(form.regularRate),
                    )}
                  </span>
                  {form.regularAmount &&
                    Math.abs(
                      form.regularAmount -
                        Number(form.regularDays) * Number(form.regularRate),
                    ) > 0.01 && (
                      <span className="text-xs text-blue-500 dark:text-blue-400 ml-2">
                        † rate split — see notes
                      </span>
                    )}
                </p>
              )}
              {Number(form.regularDays) < Number(form.totalDays) &&
                Number(form.totalDays) > 0 && (
                  <FormField
                    label="Reason for absence / reduced days"
                    hint="e.g. Holiday week 2, sickness 3 days"
                  >
                    <input
                      className="input"
                      value={form.absenceReason}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          absenceReason: e.target.value,
                        }))
                      }
                      placeholder="e.g. Annual leave 22–26 Apr, covered by temp"
                    />
                  </FormField>
                )}
            </div>

            {/* Cover drivers — multiple */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <p className="label">
                  Cover drivers{" "}
                  <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">
                    (optional)
                  </span>
                </p>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      coverEntries: [
                        ...(p.coverEntries || []),
                        {
                          id: uid(),
                          staffId: "",
                          staffName: "",
                          days: "",
                          rate: p.regularRate || "",
                          amount: 0,
                          isExternal: false,
                        },
                      ],
                    }))
                  }
                >
                  + Add cover driver
                </button>
              </div>
              {(form.coverEntries || []).length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  No cover drivers — click "+ Add cover driver" to add one.
                </p>
              )}
              {(form.coverEntries || []).some(
                (c) =>
                  Number(c.rate) > 0 &&
                  Number(c.rate) === Number(form.regularRate),
              ) && (
                <div className="alert-warn text-xs text-amber-700 dark:text-amber-400">
                  ⚠ Cover rate matches regular rate — adjust if this driver is
                  paid differently.
                </div>
              )}
              {(form.coverEntries || []).map((c, i) => (
                <div
                  key={c.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Cover driver {i + 1}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          coverEntries: p.coverEntries.filter(
                            (_, j) => j !== i,
                          ),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <FormField label="Staff member">
                    {c.isExternal ? (
                      <input
                        className="input text-sm"
                        value={c.staffName}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            coverEntries: p.coverEntries.map((x, j) =>
                              j === i ? { ...x, staffName: e.target.value } : x,
                            ),
                          }))
                        }
                        placeholder="External driver name…"
                      />
                    ) : (
                      <select
                        className="input text-sm"
                        value={c.staffId}
                        onChange={(e) => {
                          const s = staff.find((x) => x.id === e.target.value);
                          setForm((p) => ({
                            ...p,
                            coverEntries: p.coverEntries.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    staffId: e.target.value,
                                    staffName: s?.name || "",
                                  }
                                : x,
                            ),
                          }));
                        }}
                      >
                        <option value="">Select staff…</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.isExternal || false}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            coverEntries: p.coverEntries.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    isExternal: e.target.checked,
                                    staffId: "",
                                    staffName: "",
                                  }
                                : x,
                            ),
                          }))
                        }
                        className="w-3 h-3 rounded"
                      />
                      External / temp (not in staff list)
                    </label>
                  </FormField>
                  <FormGrid cols={2}>
                    <FormField label="Days covered">
                      <input
                        className="input text-sm"
                        type="number"
                        min="0"
                        step="0.5"
                        value={c.days}
                        onChange={(e) => {
                          const days = e.target.value;
                          const amount =
                            Math.round(
                              (Number(days) || 0) * (Number(c.rate) || 0) * 100,
                            ) / 100;
                          setForm((p) => ({
                            ...p,
                            coverEntries: p.coverEntries.map((x, j) =>
                              j === i ? { ...x, days, amount } : x,
                            ),
                          }));
                        }}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField
                      label="Rate (£/day)"
                      hint="Adjust if different from regular"
                    >
                      <input
                        className="input text-sm"
                        type="number"
                        step="0.01"
                        value={c.rate}
                        onChange={(e) => {
                          const rate = e.target.value;
                          const amount =
                            Math.round(
                              (Number(c.days) || 0) * (Number(rate) || 0) * 100,
                            ) / 100;
                          setForm((p) => ({
                            ...p,
                            coverEntries: p.coverEntries.map((x, j) =>
                              j === i ? { ...x, rate, amount } : x,
                            ),
                          }));
                        }}
                        placeholder="90.00"
                      />
                    </FormField>
                  </FormGrid>
                  {c.days && c.rate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Owed:{" "}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(Number(c.days) * Number(c.rate))}
                      </span>
                    </p>
                  )}
                </div>
              ))}
              {(form.coverEntries || []).length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total cover owed:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(
                      (form.coverEntries || []).reduce(
                        (s, c) =>
                          s + (Number(c.days) || 0) * (Number(c.rate) || 0),
                        0,
                      ),
                    )}
                  </span>
                </p>
              )}
            </div>

            {/* Additive band pay */}
            {(form.additiveEntries || []).length > 0 && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                <div>
                  <p className="label">Additive band pay</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Extra pay for additional service runs — enter days manually
                  </p>
                </div>
                {(form.additiveEntries || []).map((e, i) => (
                  <div
                    key={e.id || i}
                    className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 space-y-2"
                  >
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      + {e.description}
                    </p>
                    <FormGrid cols={3}>
                      <FormField label="Driver">
                        <select
                          className="input text-sm"
                          value={e.staffId}
                          onChange={(ev) => {
                            const s = staff.find(
                              (x) => x.id === ev.target.value,
                            );
                            setForm((p) => ({
                              ...p,
                              additiveEntries: p.additiveEntries.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      staffId: ev.target.value,
                                      staffName: s?.name || "",
                                    }
                                  : x,
                              ),
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
                      </FormField>
                      <FormField label="Days">
                        <input
                          className="input text-sm"
                          type="number"
                          min="0"
                          step="0.5"
                          value={e.days}
                          onChange={(ev) => {
                            const days = ev.target.value;
                            const amount =
                              Math.round(
                                (Number(days) || 0) *
                                  (Number(e.rate) || 0) *
                                  100,
                              ) / 100;
                            setForm((p) => ({
                              ...p,
                              additiveEntries: p.additiveEntries.map((x, j) =>
                                j === i ? { ...x, days, amount } : x,
                              ),
                            }));
                          }}
                          placeholder="0"
                        />
                      </FormField>
                      <FormField
                        label="Rate (£/day)"
                        hint="What you pay the driver"
                      >
                        <input
                          className="input text-sm"
                          type="number"
                          step="0.01"
                          value={e.rate}
                          onChange={(ev) => {
                            const rate = ev.target.value;
                            const amount =
                              Math.round(
                                (Number(e.days) || 0) *
                                  (Number(rate) || 0) *
                                  100,
                              ) / 100;
                            setForm((p) => ({
                              ...p,
                              additiveEntries: p.additiveEntries.map((x, j) =>
                                j === i ? { ...x, rate, amount } : x,
                              ),
                            }));
                          }}
                          placeholder="0.00"
                        />
                      </FormField>
                    </FormGrid>
                    {e.days && e.rate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Extra pay:{" "}
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {fmt(Number(e.days) * Number(e.rate))}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
                {(form.additiveEntries || []).some(
                  (e) => Number(e.days) > 0,
                ) && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total additive pay:{" "}
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {fmt(
                        (form.additiveEntries || []).reduce(
                          (s, e) =>
                            s + (Number(e.days) || 0) * (Number(e.rate) || 0),
                          0,
                        ),
                      )}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* PA section */}
            {(() => {
              const route = getRoute(form.routeId);
              if (!route?.primaryPAId && !form.paStaffId) return null;
              const pas = staff.filter(
                (s) => s.type === "pa" || s.type === "driver_pa",
              );
              return (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
                  <p className="label">PA (Personal Assistant)</p>
                  <FormGrid cols={3}>
                    <FormField label="PA staff member">
                      <select
                        className="input"
                        value={form.paStaffId}
                        onChange={(e) => {
                          const s = staff.find((x) => x.id === e.target.value);
                          setForm((p) => ({
                            ...p,
                            paStaffId: e.target.value,
                            paStaffName: s?.name || "",
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
                    <FormField label="Days worked">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.5"
                        value={form.paDays}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, paDays: e.target.value }))
                        }
                        placeholder="0"
                      />
                    </FormField>
                    <FormField label="Rate (£/day)" hint="What you pay the PA">
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={form.paRate}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, paRate: e.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </FormField>
                  </FormGrid>
                  {form.paDays && form.paRate && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      PA owed:{" "}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(Number(form.paDays) * Number(form.paRate))}
                      </span>
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Days validation */}
            {form.totalDays &&
              Number(form.regularDays) > 0 &&
              (() => {
                const coverTotal = (form.coverEntries || []).reduce(
                  (s, c) => s + (Number(c.days) || 0),
                  0,
                );
                const split = Number(form.regularDays) + coverTotal;
                const total = Number(form.totalDays);
                if (split !== total)
                  return (
                    <div className="alert-warn text-sm text-amber-700 dark:text-amber-400">
                      ⚠ Days split ({split}) doesn't match total ({total}).
                      Regular + all cover days should equal total days invoiced.
                    </div>
                  );
                return (
                  <div className="alert-success text-sm text-green-700 dark:text-green-400">
                    ✓ Days add up correctly ({split} of {total})
                  </div>
                );
              })()}

            <FormField label="Notes">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={f("notes")}
                placeholder="e.g. Driver was on holiday week 2"
              />
            </FormField>
          </div>

          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save allocation
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
