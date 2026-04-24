import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { uid, fmt } from "../lib/utils";
import DriveFilePicker from "../components/DriveFilePicker";

const EMPTY = {
  number: "",
  name: "",
  poNumber: "",
  school: "",
  primaryDriverId: "",
  primaryPAId: "",
  dailyRate: "",
  driverDailyRate: "",
  active: true,
  suspended: false,
  notes: "",
  rateBands: [],
  documents: [],
};

export default function Routes() {
  const { routes, setRoutes, staff, poHistory, setPoHistory } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showPOModal, setShowPOModal] = useState(false);
  const [poRoute, setPoRoute] = useState(null);
  const [poForm, setPoForm] = useState({
    poNumber: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const navigate = useNavigate();

  const drivers = staff.filter(
    (s) => s.type === "driver" || s.type === "driver_pa",
  );
  const pas = staff.filter((s) => s.type === "pa" || s.type === "driver_pa");

  const openAdd = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (r) => {
    setForm({
      ...r,
      dailyRate: r.dailyRate || "",
      driverDailyRate: r.driverDailyRate || "",
      rateBands: r.rateBands || [],
      suspended: r.suspended || false,
      documents: r.documents || [],
    });
    setEditing(r);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
  };
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = () => {
    if (!form.number || !form.name) return;
    // Check for duplicate route number
    const duplicate = routes.find(
      (r) => r.number === form.number && r.id !== editing?.id,
    );
    if (duplicate) {
      alert(
        `Route number ${form.number} already exists (${duplicate.name}). Please use a different number.`,
      );
      return;
    }
    const record = {
      id: editing?.id || uid(),
      ...form,
      dailyRate: parseFloat(form.dailyRate) || 0,
      driverDailyRate: parseFloat(form.driverDailyRate) || 0,
      suspended: form.suspended === true || form.suspended === "true",
      rateBands: form.rateBands || [],
      documents: form.documents || [],
      active: form.active === true || form.active === "true",
      createdAt: editing?.createdAt || Date.now(),
    };
    setRoutes(
      editing
        ? routes.map((r) => (r.id === editing.id ? record : r))
        : [...routes, record],
    );
    close();
  };

  const del = (id) => {
    if (confirm("Delete this route?"))
      setRoutes(routes.filter((r) => r.id !== id));
  };

  const openPOHistory = (r) => {
    setPoRoute(r);
    setPoForm({
      poNumber: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      notes: "",
    });
    setShowPOModal(true);
  };

  const saveNewPO = () => {
    if (!poForm.poNumber || !poRoute) return;
    // Close out current PO in history
    const today = new Date().toISOString().split("T")[0];
    const existing = poHistory.filter((p) => p.routeId === poRoute.id);
    const updated = existing.map((p) =>
      p.endDate ? p : { ...p, endDate: today },
    );
    // Add new PO to history
    const newEntry = {
      id: uid(),
      routeId: poRoute.id,
      routeNumber: poRoute.number,
      poNumber: poForm.poNumber,
      startDate: poForm.startDate,
      endDate: poForm.endDate || null,
      notes: poForm.notes,
      createdAt: Date.now(),
    };
    const otherHistory = poHistory.filter((p) => p.routeId !== poRoute.id);
    setPoHistory([...otherHistory, ...updated, newEntry]);
    // Update route's current PO number
    setRoutes(
      routes.map((r) =>
        r.id === poRoute.id ? { ...r, poNumber: poForm.poNumber } : r,
      ),
    );
    setShowPOModal(false);
  };

  const filtered = routes
    .filter((r) => {
      if (filter === "active" && !r.active) return false;
      if (filter === "inactive" && r.active) return false;
      if (
        search &&
        !r.number.includes(search) &&
        !r.name.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => Number(a.number) - Number(b.number));

  const getName = (id) => staff.find((s) => s.id === id)?.name || "—";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Routes"
        subtitle={`${routes.filter((r) => r.active).length} active routes`}
        actions={
          <button className="btn-primary" onClick={openAdd}>
            + Add route
          </button>
        }
      />

      <div className="toolbar">
        <input
          className="input w-56"
          placeholder="Search routes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-36"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All routes</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="page-body !space-y-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🛣️"
            title="No routes yet"
            description="Add your school routes to link them with invoices and staff."
            action={
              <button className="btn-primary" onClick={openAdd}>
                Add first route
              </button>
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="thead-row">
                  <th className="th">Route</th>
                  <th className="th">PO Number</th>
                  <th className="th">School</th>
                  <th className="th">Driver</th>
                  <th className="th">PA</th>
                  <th className="th-r">WSCC rate</th>
                  <th className="th-r">Driver rate</th>
                  <th className="th-r">Margin/day</th>
                  <th className="th">Rate bands</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((r) => (
                  <tr key={r.id} className="tr">
                    <td className="td">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        Route {r.number}
                      </p>
                      <p className="muted">{r.name}</p>
                    </td>
                    <td className="td font-mono text-xs text-gray-500 dark:text-gray-400">
                      {r.poNumber || "—"}
                    </td>
                    <td className="td text-gray-600 dark:text-gray-400">
                      {r.school || "—"}
                    </td>
                    <td className="td text-gray-700 dark:text-gray-300">
                      {getName(r.primaryDriverId)}
                    </td>
                    <td className="td text-gray-700 dark:text-gray-300">
                      {getName(r.primaryPAId)}
                    </td>
                    <td className="td-r font-medium">
                      {r.dailyRate ? fmt(r.dailyRate) : "—"}
                    </td>
                    <td className="td-r text-gray-500 dark:text-gray-400">
                      {r.driverDailyRate ? fmt(r.driverDailyRate) : "—"}
                    </td>
                    <td className="td-r font-medium text-green-700 dark:text-green-400">
                      {r.dailyRate && r.driverDailyRate
                        ? fmt(r.dailyRate - r.driverDailyRate)
                        : "—"}
                    </td>
                    <td className="td">
                      {r.rateBands?.length > 0 ? (
                        <span className="chip-blue">
                          {r.rateBands.length} band
                          {r.rateBands.length > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          standard
                        </span>
                      )}
                    </td>
                    <td className="td">
                      {r.suspended ? (
                        <Badge type="partial" label="Suspended" />
                      ) : (
                        <Badge type={r.active ? "active" : "inactive"} />
                      )}
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        <button
                          className="btn-ghost"
                          onClick={() => openEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost text-blue-500 dark:text-blue-400"
                          onClick={() => openPOHistory(r)}
                        >
                          PO
                        </button>
                        <button
                          className="btn-ghost text-purple-500 dark:text-purple-400"
                          onClick={() => navigate(`/routes/${r.id}/children`)}
                        >
                          Children
                        </button>
                        <button
                          className="btn-ghost text-red-500 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => del(r.id)}
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

      {showModal && (
        <Modal
          title={editing ? "Edit route" : "Add route"}
          onClose={close}
          size="lg"
        >
          <div className="space-y-4">
            <FormGrid cols={2}>
              <FormField label="Route number *">
                <input
                  className="input"
                  value={form.number}
                  onChange={f("number")}
                  placeholder="50540"
                />
              </FormField>
              <FormField label="Route name *">
                <input
                  className="input"
                  value={form.name}
                  onChange={f("name")}
                  placeholder="Philpots taxi"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="PO number">
                <input
                  className="input font-mono"
                  value={form.poNumber}
                  onChange={f("poNumber")}
                  placeholder="WSP000000786"
                />
              </FormField>
              <FormField label="School name">
                <input
                  className="input"
                  value={form.school}
                  onChange={f("school")}
                  placeholder="Philpots Manor School"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Primary driver">
                <select
                  className="input"
                  value={form.primaryDriverId}
                  onChange={f("primaryDriverId")}
                >
                  <option value="">None</option>
                  {drivers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Primary PA">
                <select
                  className="input"
                  value={form.primaryPAId}
                  onChange={f("primaryPAId")}
                >
                  <option value="">None</option>
                  {pas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="WSCC daily rate (£)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.dailyRate}
                  onChange={f("dailyRate")}
                  placeholder="116.88"
                />
              </FormField>
              <FormField label="Driver daily rate (£)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.driverDailyRate}
                  onChange={f("driverDailyRate")}
                  placeholder="90.00"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Status">
                <select
                  className="input"
                  value={
                    form.suspended
                      ? "suspended"
                      : form.active
                        ? "active"
                        : "inactive"
                  }
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      active: e.target.value === "active",
                      suspended: e.target.value === "suspended",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended (temporary)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </FormField>
              {form.suspended && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  ⚠ Suspended routes are excluded from invoice generation
                  automatically.
                </p>
              )}
            </FormGrid>

            {/* Rate bands */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3">
              <div className="flex items-center justify-between">
                <p className="label">
                  Rate bands{" "}
                  <span className="text-gray-400 dark:text-gray-500 normal-case font-normal">
                    (optional — for routes with multiple prices)
                  </span>
                </p>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() =>
                    setForm((p) => ({
                      ...p,
                      rateBands: [
                        ...(p.rateBands || []),
                        {
                          id: Date.now(),
                          description: "",
                          wsccRate: "",
                          driverRate: "",
                        },
                      ],
                    }))
                  }
                >
                  + Add band
                </button>
              </div>

              {(form.rateBands || []).length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  No bands — uses the standard WSCC / driver rates above. Add
                  bands if this route has different prices on different days.
                </p>
              )}

              {(form.rateBands || []).map((band, i) => (
                <div
                  key={band.id}
                  className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="col-span-3">
                      <input
                        className="input text-sm"
                        placeholder="Description e.g. Mon–Wed 2 children"
                        value={band.description}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            rateBands: p.rateBands.map((b, j) =>
                              j === i
                                ? { ...b, description: e.target.value }
                                : b,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label mb-1">WSCC rate (£)</label>
                      <input
                        className="input text-sm"
                        type="number"
                        step="0.01"
                        placeholder="116.88"
                        value={band.wsccRate}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            rateBands: p.rateBands.map((b, j) =>
                              j === i ? { ...b, wsccRate: e.target.value } : b,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="label mb-1">Driver rate (£)</label>
                      <input
                        className="input text-sm"
                        type="number"
                        step="0.01"
                        placeholder="90.00"
                        value={band.driverRate}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            rateBands: p.rateBands.map((b, j) =>
                              j === i
                                ? { ...b, driverRate: e.target.value }
                                : b,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <div className="w-full bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Margin
                        </p>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                          {band.wsccRate && band.driverRate
                            ? fmt(
                                Number(band.wsccRate) - Number(band.driverRate),
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 mt-1 text-lg leading-none"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        rateBands: p.rateBands.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <DriveFilePicker
              label="Route documents (schedule, risk assessment, etc.)"
              documents={form.documents || []}
              onChange={(docs) => setForm((p) => ({ ...p, documents: docs }))}
            />

            <FormField label="Notes">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={f("notes")}
                placeholder="Additional details…"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save route
            </button>
          </ModalFooter>
        </Modal>
      )}

      {showPOModal && poRoute && (
        <Modal
          title={`PO history — Route ${poRoute.number}`}
          onClose={() => setShowPOModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            {/* History log */}
            {poHistory.filter((p) => p.routeId === poRoute.id).length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No PO history recorded yet.
              </p>
            ) : (
              <div className="card overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="thead-row">
                      <th className="th">PO Number</th>
                      <th className="th">From</th>
                      <th className="th">To</th>
                      <th className="th">Notes</th>
                      <th className="th"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {[...poHistory.filter((p) => p.routeId === poRoute.id)]
                      .sort(
                        (a, b) => new Date(b.startDate) - new Date(a.startDate),
                      )
                      .map((p) => (
                        <tr key={p.id} className="tr">
                          <td className="td font-mono font-semibold">
                            {p.poNumber}
                          </td>
                          <td className="td text-gray-600 dark:text-gray-400">
                            {p.startDate}
                          </td>
                          <td className="td text-gray-600 dark:text-gray-400">
                            {p.endDate ? (
                              p.endDate
                            ) : (
                              <span className="chip-green">Current</span>
                            )}
                          </td>
                          <td className="td text-xs text-gray-500 dark:text-gray-400">
                            {p.notes || "—"}
                          </td>
                          <td className="td">
                            <button
                              className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs"
                              onClick={() => {
                                if (confirm("Remove this PO history entry?"))
                                  setPoHistory(
                                    poHistory.filter((x) => x.id !== p.id),
                                  );
                              }}
                            >
                              Del
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add new PO */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">Add new PO number</p>
              <div className="space-y-3">
                <FormGrid cols={2}>
                  <FormField label="New PO number *">
                    <input
                      className="input font-mono"
                      value={poForm.poNumber}
                      onChange={(e) =>
                        setPoForm((p) => ({ ...p, poNumber: e.target.value }))
                      }
                      placeholder="WSP000001234"
                    />
                  </FormField>
                  <FormField label="Effective from">
                    <input
                      className="input"
                      type="date"
                      value={poForm.startDate}
                      onChange={(e) =>
                        setPoForm((p) => ({ ...p, startDate: e.target.value }))
                      }
                    />
                  </FormField>
                </FormGrid>
                <FormField label="Notes">
                  <input
                    className="input"
                    value={poForm.notes}
                    onChange={(e) =>
                      setPoForm((p) => ({ ...p, notes: e.target.value }))
                    }
                    placeholder="e.g. New academic year 2025/26"
                  />
                </FormField>
                <div className="alert-info text-xs text-blue-700 dark:text-blue-400">
                  Saving will update the route's current PO number and close out
                  the previous one in history.
                </div>
              </div>
            </div>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowPOModal(false)}
            >
              Close
            </button>
            <button
              className="btn-primary"
              onClick={saveNewPO}
              disabled={!poForm.poNumber}
            >
              Save new PO
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
