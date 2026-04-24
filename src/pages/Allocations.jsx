import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import {
  uid,
  fmt,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
} from "../lib/utils";

const EMPTY = {
  routeId: "",
  month: currentMonth(),
  year: currentYear(),
  totalDays: "",
  regularStaffId: "",
  regularDays: "",
  regularRate: "",
  tempStaffId: "",
  tempStaffName: "",
  tempDays: "",
  tempRate: "",
  absenceReason: "",
  notes: "",
};

export default function Allocations() {
  const { allocations, setAllocations, routes, staff, invoices, attendance } =
    useApp();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [monthF, setMonthF] = useState(currentMonth());
  const [yearF, setYearF] = useState(currentYear());

  const drivers = staff.filter(
    (s) => s.type === "driver" || s.type === "driver_pa",
  );

  const getAttendanceSplit = (routeId, month, year) => {
    const records = attendance.filter(
      (a) =>
        a.routeId === routeId &&
        a.month === month &&
        a.year === year &&
        a.status !== "no_run",
    );
    const byDriver = {};
    records.forEach((a) => {
      if (!a.driverId) return;
      if (!byDriver[a.driverId])
        byDriver[a.driverId] = { name: a.driverName, days: 0 };
      byDriver[a.driverId].days += a.daysValue ?? 1;
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
        x.routeNumber === route?.number &&
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

    setForm((p) => ({
      ...p,
      routeId,
      totalDays,
      regularRate: route?.driverDailyRate || "",
      // Pre-fill regular staff from attendance if found
      regularStaffId: primary
        ? staff.find((s) => s.name === primary[1].name)?.id || p.regularStaffId
        : p.regularStaffId,
      regularDays: primary ? primary[1].days : "",
      // Pre-fill temp cover if found
      tempStaffId: cover
        ? staff.find((s) => s.name === cover[1].name)?.id || ""
        : "",
      tempStaffName: cover ? cover[1].name : "",
      tempDays: cover ? cover[1].days : "",
    }));
  };

  const openAdd = () => {
    setForm({ ...EMPTY, month: monthF, year: yearF });
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (a) => {
    setForm({
      routeId: a.routeId,
      month: a.month,
      year: a.year,
      totalDays: a.totalDays,
      regularStaffId: a.regularStaffId,
      regularDays: a.regularDays,
      regularRate: a.regularRate,
      tempStaffId: a.tempStaffId || "",
      tempStaffName: a.tempStaffName || "",
      tempDays: a.tempDays || "",
      tempRate: a.tempRate || "",
      notes: a.notes || "",
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
    const tempDays = Number(form.tempDays) || 0;
    const tempRate = Number(form.tempRate) || 0;
    const regularAmount = Math.round(regularDays * regularRate * 100) / 100;
    const tempAmount = Math.round(tempDays * tempRate * 100) / 100;

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
      tempStaffId: form.tempStaffId || null,
      tempStaffName: form.tempStaffName || "",
      tempDays,
      tempRate,
      tempAmount,
      absenceReason: form.absenceReason || "",
      notes: form.notes || "",
      createdAt: editing?.createdAt || Date.now(),
    };

    setAllocations(
      editing
        ? allocations.map((a) => (a.id === editing.id ? record : a))
        : [...allocations, record],
    );
    close();
  };

  const del = (id) => {
    if (confirm("Delete this allocation?"))
      setAllocations(allocations.filter((a) => a.id !== id));
  };

  // Filter by month/year
  const filtered = allocations
    .filter((a) => a.month === monthF && a.year === yearF)
    .sort((a, b) => a.routeNumber?.localeCompare(b.routeNumber));

  // Month totals
  const totalRegular = filtered.reduce((s, a) => s + (a.regularAmount || 0), 0);
  const totalTemp = filtered.reduce((s, a) => s + (a.tempAmount || 0), 0);
  const totalOwed = totalRegular + totalTemp;

  // Days check — warn if allocation days don't match invoice days
  const getDaysWarning = (a) => {
    const inv = invoices.find(
      (x) =>
        x.routeNumber === a.routeNumber &&
        x.month === a.month &&
        x.year === a.year,
    );
    if (!inv) return null;
    const allocTotal = (a.regularDays || 0) + (a.tempDays || 0);
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
          onChange={(e) => setMonthF(Number(e.target.value))}
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
          onChange={(e) => setYearF(Number(e.target.value))}
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
            <table className="min-w-full">
              <thead>
                <tr className="thead-row">
                  <th className="th">Route</th>
                  <th className="th">Regular staff</th>
                  <th className="th-r">Days</th>
                  <th className="th-r">Rate</th>
                  <th className="th-r">Owed</th>
                  <th className="th">Temp cover</th>
                  <th className="th-r">Days</th>
                  <th className="th-r">Rate</th>
                  <th className="th-r">Owed</th>
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
                          Route {a.routeNumber}
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
                      </td>
                      <td className="td-r font-medium text-gray-900 dark:text-gray-100">
                        {fmt(a.regularAmount)}
                      </td>
                      <td className="td">
                        {a.tempDays > 0 ? (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {a.tempStaffName || getStaffName(a.tempStaffId)}
                          </p>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="td-r text-gray-500 dark:text-gray-400">
                        {a.tempDays > 0 ? a.tempDays : "—"}
                      </td>
                      <td className="td-r text-gray-500 dark:text-gray-400">
                        {a.tempDays > 0 ? fmt(a.tempRate) : "—"}
                      </td>
                      <td className="td-r text-gray-700 dark:text-gray-300">
                        {a.tempDays > 0 ? fmt(a.tempAmount) : "—"}
                      </td>
                      <td className="td-r font-semibold text-green-700 dark:text-green-400">
                        {fmt((a.regularAmount || 0) + (a.tempAmount || 0))}
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
                  <td className="td-r font-semibold">{fmt(totalTemp)}</td>
                  <td className="td-r font-bold text-green-700 dark:text-green-400">
                    {fmt(totalOwed)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
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
                        Route {r.number} — {r.name}
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
              label="Total days invoiced to WSCC"
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
                    {fmt(Number(form.regularDays) * Number(form.regularRate))}
                  </span>
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

            {/* Temp cover */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">
                Temp cover{" "}
                <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">
                  (optional)
                </span>
              </p>
              {/* <FormGrid cols={2}> */}
              <FormField label="Cover staff member">
                <select
                  className="input"
                  value={form.tempStaffId}
                  onChange={(e) => {
                    const s = staff.find((x) => x.id === e.target.value);
                    setForm((p) => ({
                      ...p,
                      tempStaffId: e.target.value,
                      tempStaffName: s?.name || "",
                    }));
                  }}
                >
                  <option value="">Select staff member…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              {/* </FormGrid> */}
              <FormGrid cols={2}>
                <FormField label="Days covered">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={form.tempDays}
                    onChange={f("tempDays")}
                    placeholder="0"
                  />
                </FormField>
                <FormField label="Rate (£/day)">
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.tempRate}
                    onChange={f("tempRate")}
                    placeholder="75.00"
                  />
                </FormField>
              </FormGrid>
              {form.tempDays && form.tempRate && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Temp owed:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(Number(form.tempDays) * Number(form.tempRate))}
                  </span>
                </p>
              )}
            </div>

            {/* Days validation */}
            {form.totalDays &&
              Number(form.regularDays) + Number(form.tempDays || 0) > 0 &&
              (() => {
                const split =
                  Number(form.regularDays) + Number(form.tempDays || 0);
                const total = Number(form.totalDays);
                if (split !== total)
                  return (
                    <div className="alert-warn text-sm text-amber-700 dark:text-amber-400">
                      ⚠ Days split ({split}) doesn't match total days ({total}).
                      Regular + temp days should equal total days invoiced.
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
