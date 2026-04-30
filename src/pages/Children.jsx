import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { uid, fmtD } from "../lib/utils";
import DocumentUploader from "../components/DocumentUploader";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_NUMS = [1, 2, 3, 4, 5];

const STATUS_BADGE = {
  active: "active",
  suspended: "partial",
  ended: "inactive",
};

const EMPTY = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  schoolName: "",
  schoolAddress: "",
  travelDays: [1, 2, 3, 4, 5],
  amPickupTime: "",
  pmPickupTime: "",
  pickupAddresses: [
    { id: uid(), address: "", days: [1, 2, 3, 4, 5], notes: "" },
  ],
  dropoffAddress: "",
  amOnly: false,
  pmOnly: false,
  afterschoolClubs: [],
  requiresPA: false,
  paRequirements: "",
  parentContacts: [
    { id: uid(), name: "", phone: "", email: "", relationship: "" },
  ],
  carePlanNotes: "",
  medicalNotes: "",
  status: "active",
  startDate: "",
  endDate: "",
  notes: "",
  documents: [],
};

export default function Children() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const { routes, pupils, setPupils } = useApp();

  const route = routes.find((r) => r.id === routeId);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState("details");

  const routePupils = pupils
    .filter((p) => p.routeId === routeId)
    .sort((a, b) => a.firstName?.localeCompare(b.firstName));

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fBool = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.checked }));

  const openAdd = () => {
    setForm({
      ...EMPTY,
      pickupAddresses: [
        { id: uid(), address: "", days: [1, 2, 3, 4, 5], notes: "" },
      ],
      parentContacts: [
        { id: uid(), name: "", phone: "", email: "", relationship: "" },
      ],
    });
    setEditing(null);
    setTab("details");
    setShowModal(true);
  };

  const openEdit = (p) => {
    setForm({ ...p });
    setEditing(p);
    setTab("details");
    setShowModal(true);
  };

  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.firstName || !form.lastName) return;
    const record = {
      id: editing?.id || uid(),
      routeId,
      routeNumber: route?.number || "",
      ...form,
      createdAt: editing?.createdAt || Date.now(),
    };
    setPupils(
      editing
        ? pupils.map((p) => (p.id === editing.id ? record : p))
        : [...pupils, record],
    );
    close();
  };

  const del = (id) => {
    if (confirm("Remove this child from the route?"))
      setPupils(pupils.filter((p) => p.id !== id));
  };

  const toggleDay = (day) => {
    setForm((p) => ({
      ...p,
      travelDays: p.travelDays.includes(day)
        ? p.travelDays.filter((d) => d !== day)
        : [...p.travelDays, day].sort(),
    }));
  };

  // Pickup addresses
  const addAddress = () =>
    setForm((p) => ({
      ...p,
      pickupAddresses: [
        ...p.pickupAddresses,
        { id: uid(), address: "", days: [1, 2, 3, 4, 5], notes: "" },
      ],
    }));
  const updateAddress = (id, key, val) =>
    setForm((p) => ({
      ...p,
      pickupAddresses: p.pickupAddresses.map((a) =>
        a.id === id ? { ...a, [key]: val } : a,
      ),
    }));
  const removeAddress = (id) =>
    setForm((p) => ({
      ...p,
      pickupAddresses: p.pickupAddresses.filter((a) => a.id !== id),
    }));
  const toggleAddressDay = (addrId, day) =>
    setForm((p) => ({
      ...p,
      pickupAddresses: p.pickupAddresses.map((a) =>
        a.id === addrId
          ? {
              ...a,
              days: a.days.includes(day)
                ? a.days.filter((d) => d !== day)
                : [...a.days, day].sort(),
            }
          : a,
      ),
    }));

  // After school clubs
  const addClub = () =>
    setForm((p) => ({
      ...p,
      afterschoolClubs: [
        ...p.afterschoolClubs,
        { id: uid(), day: 3, pickupTime: "", notes: "" },
      ],
    }));
  const updateClub = (id, key, val) =>
    setForm((p) => ({
      ...p,
      afterschoolClubs: p.afterschoolClubs.map((c) =>
        c.id === id ? { ...c, [key]: val } : c,
      ),
    }));
  const removeClub = (id) =>
    setForm((p) => ({
      ...p,
      afterschoolClubs: p.afterschoolClubs.filter((c) => c.id !== id),
    }));

  // Parent contacts
  const addContact = () =>
    setForm((p) => ({
      ...p,
      parentContacts: [
        ...p.parentContacts,
        { id: uid(), name: "", phone: "", email: "", relationship: "" },
      ],
    }));
  const updateContact = (id, key, val) =>
    setForm((p) => ({
      ...p,
      parentContacts: p.parentContacts.map((c) =>
        c.id === id ? { ...c, [key]: val } : c,
      ),
    }));
  const removeContact = (id) =>
    setForm((p) => ({
      ...p,
      parentContacts: p.parentContacts.filter((c) => c.id !== id),
    }));

  if (!route)
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          title="Children"
          subtitle="Route not found"
          actions={
            <button
              className="btn-secondary"
              onClick={() => navigate("/routes")}
            >
              ← Back to routes
            </button>
          }
        />
      </div>
    );

  const DayPill = ({ day, active, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
      }`}
    >
      {DAYS[day - 1]}
    </button>
  );

  const TABS = [
    { id: "details", label: "Details" },
    { id: "travel", label: "Travel" },
    { id: "contacts", label: "Contacts" },
    { id: "care", label: "Care & medical" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title={`Route ${route.number} — Children`}
        subtitle={`${route.name} · ${routePupils.length} child${routePupils.length !== 1 ? "ren" : ""}`}
        actions={
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => navigate("/routes")}
            >
              ← Routes
            </button>
            <button className="btn-primary" onClick={openAdd}>
              + Add child
            </button>
          </div>
        }
      />

      <div className="page-body !space-y-0">
        {routePupils.length === 0 ? (
          <EmptyState
            icon="🧒"
            title="No children on this route yet"
            description="Add the children who travel on this route with their school, pickup times, and parent contacts."
            action={
              <button className="btn-primary" onClick={openAdd}>
                Add first child
              </button>
            }
          />
        ) : (
          <div className="space-y-4">
            {routePupils.map((p) => (
              <div key={p.id} className="card p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 avatar text-base flex-shrink-0">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {p.firstName} {p.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          type={STATUS_BADGE[p.status] || "active"}
                          label={p.status}
                        />
                        {p.requiresPA && (
                          <span className="chip-purple text-xs">
                            Requires PA
                          </span>
                        )}
                        {p.amOnly && (
                          <span className="chip-blue text-xs">AM only</span>
                        )}
                        {p.pmOnly && (
                          <span className="chip-blue text-xs">PM only</span>
                        )}
                        {p.afterschoolClubs?.length > 0 && (
                          <span className="chip-amber text-xs">
                            {p.afterschoolClubs.length} after-school club
                            {p.afterschoolClubs.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => del(p.id)}
                    >
                      Del
                    </button>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {/* School */}
                  <div>
                    <p className="label mb-1">School</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {p.schoolName || "—"}
                    </p>
                    {p.schoolAddress && (
                      <p className="muted text-xs mt-0.5">{p.schoolAddress}</p>
                    )}
                  </div>

                  {/* Travel days */}
                  <div>
                    <p className="label mb-1">Travel days</p>
                    <div className="flex gap-1 flex-wrap">
                      {DAY_NUMS.map((d) => (
                        <span
                          key={d}
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            p.travelDays?.includes(d)
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600"
                          }`}
                        >
                          {DAYS[d - 1]}
                        </span>
                      ))}
                    </div>
                    <p className="muted text-xs mt-1">
                      {p.travelDays?.length || 0} days/week
                    </p>
                  </div>

                  {/* Pickup times */}
                  <div>
                    <p className="label mb-1">Pickup times</p>
                    {p.amPickupTime && (
                      <p className="text-xs text-gray-700 dark:text-gray-300">
                        🌅 AM: {p.amPickupTime}
                      </p>
                    )}
                    {p.pmPickupTime && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
                        🌆 PM: {p.pmPickupTime}
                      </p>
                    )}
                    {!p.amPickupTime && !p.pmPickupTime && (
                      <p className="muted text-xs">Not set</p>
                    )}
                  </div>
                </div>

                {/* Pickup addresses */}
                {p.pickupAddresses?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <p className="label mb-2">
                      Pickup address{p.pickupAddresses.length > 1 ? "es" : ""}
                    </p>
                    <div className="space-y-1.5">
                      {p.pickupAddresses.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-400 dark:text-gray-500 mt-0.5">
                            📍
                          </span>
                          <div>
                            <span className="text-gray-700 dark:text-gray-300">
                              {a.address}
                            </span>
                            {a.days?.length < 5 && (
                              <span className="ml-2 text-blue-600 dark:text-blue-400">
                                ({a.days.map((d) => DAYS[d - 1]).join(", ")})
                              </span>
                            )}
                            {a.notes && (
                              <span className="ml-2 text-gray-400 dark:text-gray-500 italic">
                                {a.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* After school clubs */}
                {p.afterschoolClubs?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="label mb-2">After-school clubs</p>
                    <div className="flex flex-wrap gap-2">
                      {p.afterschoolClubs.map((c, i) => (
                        <div key={i} className="chip-amber text-xs">
                          {DAYS[c.day - 1]}: {c.pickupTime || "time TBC"}
                          {c.notes && ` — ${c.notes}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parent contacts */}
                {p.parentContacts?.filter((c) => c.name).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="label mb-2">Parent / guardian contacts</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.parentContacts
                        .filter((c) => c.name)
                        .map((c, i) => (
                          <div key={i} className="text-xs space-y-0.5">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {c.name}
                              {c.relationship && (
                                <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">
                                  ({c.relationship})
                                </span>
                              )}
                            </p>
                            {c.phone && (
                              <p className="text-gray-500 dark:text-gray-400">
                                📞 {c.phone}
                              </p>
                            )}
                            {c.email && (
                              <p className="text-gray-500 dark:text-gray-400">
                                ✉ {c.email}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {p.documents?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="label mb-2">📎 Documents</p>
                    <div className="flex flex-wrap gap-2">
                      {p.documents.map((doc, i) => (
                        <a
                          key={i}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          📄 {doc.name || "Document"}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Care notes */}
                {(p.carePlanNotes || p.medicalNotes || p.paRequirements) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    {p.requiresPA && p.paRequirements && (
                      <div className="text-xs mb-1.5">
                        <span className="font-semibold text-purple-700 dark:text-purple-400">
                          PA requirements:{" "}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {p.paRequirements}
                        </span>
                      </div>
                    )}
                    {p.medicalNotes && (
                      <div className="text-xs mb-1.5">
                        <span className="font-semibold text-red-700 dark:text-red-400">
                          Medical:{" "}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {p.medicalNotes}
                        </span>
                      </div>
                    )}
                    {p.carePlanNotes && (
                      <div className="text-xs">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          Care plan:{" "}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {p.carePlanNotes}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <Modal
          title={
            editing ? `Edit — ${form.firstName} ${form.lastName}` : "Add child"
          }
          onClose={close}
          size="lg"
        >
          {/* Tab bar */}
          <div className="flex gap-1 mb-5 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Details ── */}
          {tab === "details" && (
            <div className="space-y-4">
              <FormGrid cols={2}>
                <FormField label="First name *">
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={f("firstName")}
                    placeholder="Poppy"
                  />
                </FormField>
                <FormField label="Last name *">
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={f("lastName")}
                    placeholder="Smith"
                  />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="Date of birth">
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfBirth || ""}
                    onChange={f("dateOfBirth")}
                  />
                </FormField>
                <FormField label="Status">
                  <select
                    className="input"
                    value={form.status}
                    onChange={f("status")}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended (temporary)</option>
                    <option value="ended">Ended</option>
                  </select>
                </FormField>
              </FormGrid>
              <FormField label="School name">
                <input
                  className="input"
                  value={form.schoolName}
                  onChange={f("schoolName")}
                  placeholder="Philpots Manor School"
                />
              </FormField>
              <FormField label="School address">
                <input
                  className="input"
                  value={form.schoolAddress}
                  onChange={f("schoolAddress")}
                  placeholder="School Lane, Haywards Heath..."
                />
              </FormField>
              <FormGrid cols={2}>
                <FormField label="Start date">
                  <input
                    className="input"
                    type="date"
                    value={form.startDate || ""}
                    onChange={f("startDate")}
                  />
                </FormField>
                <FormField label="End date">
                  <input
                    className="input"
                    type="date"
                    value={form.endDate || ""}
                    onChange={f("endDate")}
                  />
                </FormField>
              </FormGrid>
              <FormField label="Notes">
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="General notes..."
                />
              </FormField>
            </div>
          )}

          {/* ── Tab: Travel ── */}
          {tab === "travel" && (
            <div className="space-y-4">
              {/* Travel days */}
              <FormField label="Travel days">
                <div className="flex gap-2 mt-1">
                  {DAY_NUMS.map((d) => (
                    <DayPill
                      key={d}
                      day={d}
                      active={form.travelDays?.includes(d)}
                      onClick={() => toggleDay(d)}
                    />
                  ))}
                </div>
              </FormField>

              {/* AM/PM only flags */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.amOnly}
                    onChange={fBool("amOnly")}
                    className="w-4 h-4 rounded"
                  />
                  AM only (parent collects in PM)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pmOnly}
                    onChange={fBool("pmOnly")}
                    className="w-4 h-4 rounded"
                  />
                  PM only (parent drops in AM)
                </label>
              </div>

              {/* Pickup times */}
              <FormGrid cols={2}>
                <FormField
                  label="AM pickup time"
                  hint="Time driver collects child in morning"
                >
                  <input
                    className="input"
                    type="time"
                    value={form.amPickupTime || ""}
                    onChange={f("amPickupTime")}
                  />
                </FormField>
                <FormField
                  label="PM pickup time"
                  hint="Time driver collects from school"
                >
                  <input
                    className="input"
                    type="time"
                    value={form.pmPickupTime || ""}
                    onChange={f("pmPickupTime")}
                  />
                </FormField>
              </FormGrid>

              {/* Pickup addresses */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="label">Pickup addresses</p>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={addAddress}
                  >
                    + Add address
                  </button>
                </div>
                <p className="muted text-xs mb-3">
                  Add multiple addresses if the child is collected from
                  different locations on different days.
                </p>
                <div className="space-y-3">
                  {form.pickupAddresses.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2"
                    >
                      <FormField label="Address">
                        <input
                          className="input"
                          value={a.address}
                          onChange={(e) =>
                            updateAddress(a.id, "address", e.target.value)
                          }
                          placeholder="123 Home Street, Crawley..."
                        />
                      </FormField>
                      <div>
                        <p className="label mb-1.5">Applies on days</p>
                        <div className="flex gap-1.5">
                          {DAY_NUMS.map((d) => (
                            <DayPill
                              key={d}
                              day={d}
                              active={a.days?.includes(d)}
                              onClick={() => toggleAddressDay(a.id, d)}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <FormField label="Notes">
                            <input
                              className="input text-xs"
                              value={a.notes}
                              onChange={(e) =>
                                updateAddress(a.id, "notes", e.target.value)
                              }
                              placeholder="e.g. Ring doorbell, gate code 1234"
                            />
                          </FormField>
                        </div>
                        {form.pickupAddresses.length > 1 && (
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-600 mb-1 text-lg leading-none flex-shrink-0"
                            onClick={() => removeAddress(a.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dropoff address */}
              <FormField label="Dropoff address (if different from pickup)">
                <input
                  className="input"
                  value={form.dropoffAddress}
                  onChange={f("dropoffAddress")}
                  placeholder="Leave blank if same as pickup"
                />
              </FormField>

              {/* After school clubs */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="label">After-school clubs</p>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={addClub}
                  >
                    + Add club
                  </button>
                </div>
                {form.afterschoolClubs.length === 0 ? (
                  <p className="muted text-xs">
                    No after-school clubs. Add one if the child stays late on
                    specific days.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.afterschoolClubs.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-end gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-800/30"
                      >
                        <FormField label="Day">
                          <select
                            className="input w-24"
                            value={c.day}
                            onChange={(e) =>
                              updateClub(c.id, "day", Number(e.target.value))
                            }
                          >
                            {DAY_NUMS.map((d) => (
                              <option key={d} value={d}>
                                {DAYS[d - 1]}
                              </option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Pickup time">
                          <input
                            className="input w-32"
                            type="time"
                            value={c.pickupTime}
                            onChange={(e) =>
                              updateClub(c.id, "pickupTime", e.target.value)
                            }
                          />
                        </FormField>
                        <div className="flex-1">
                          <FormField label="Club name / notes">
                            <input
                              className="input"
                              value={c.notes}
                              onChange={(e) =>
                                updateClub(c.id, "notes", e.target.value)
                              }
                              placeholder="e.g. Football club"
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 mb-1 text-lg leading-none flex-shrink-0"
                          onClick={() => removeClub(c.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Contacts ── */}
          {tab === "contacts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add parent and guardian contact details.
                </p>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={addContact}
                >
                  + Add contact
                </button>
              </div>
              {form.parentContacts.map((c, i) => (
                <div
                  key={c.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Contact {i + 1}
                    </p>
                    {form.parentContacts.length > 1 && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                        onClick={() => removeContact(c.id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <FormGrid cols={2}>
                    <FormField label="Full name">
                      <input
                        className="input"
                        value={c.name}
                        onChange={(e) =>
                          updateContact(c.id, "name", e.target.value)
                        }
                        placeholder="Jane Smith"
                      />
                    </FormField>
                    <FormField label="Relationship">
                      <input
                        className="input"
                        value={c.relationship}
                        onChange={(e) =>
                          updateContact(c.id, "relationship", e.target.value)
                        }
                        placeholder="Mother / Father / Guardian"
                      />
                    </FormField>
                  </FormGrid>
                  <FormGrid cols={2}>
                    <FormField label="Phone">
                      <input
                        className="input"
                        value={c.phone}
                        onChange={(e) =>
                          updateContact(c.id, "phone", e.target.value)
                        }
                        placeholder="07xxx xxxxxx"
                      />
                    </FormField>
                    <FormField label="Email">
                      <input
                        className="input"
                        type="email"
                        value={c.email}
                        onChange={(e) =>
                          updateContact(c.id, "email", e.target.value)
                        }
                        placeholder="parent@email.com"
                      />
                    </FormField>
                  </FormGrid>
                </div>
              ))}
            </div>
          )}

          {/* ── Tab: Care & medical ── */}
          {tab === "care" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresPA}
                    onChange={fBool("requiresPA")}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-medium">
                    This child requires a Passenger Assistant (PA)
                  </span>
                </label>
                {form.requiresPA && (
                  <FormField label="PA requirements / qualifications needed">
                    <textarea
                      className="input"
                      rows={2}
                      value={form.paRequirements}
                      onChange={f("paRequirements")}
                      placeholder="e.g. Must have experience with autism. Enhanced DBS required."
                    />
                  </FormField>
                )}
              </div>

              <FormField
                label="Medical notes"
                hint="Allergies, medication, conditions the driver needs to know about"
              >
                <textarea
                  className="input"
                  rows={3}
                  value={form.medicalNotes}
                  onChange={f("medicalNotes")}
                  placeholder="e.g. Severe nut allergy — carries EpiPen. Epilepsy — seizure protocol in file."
                />
              </FormField>

              <FormField
                label="Care plan notes"
                hint="Key points from the child's care plan relevant to transport"
              >
                <textarea
                  className="input"
                  rows={3}
                  value={form.carePlanNotes}
                  onChange={f("carePlanNotes")}
                  placeholder="e.g. Child must be secured with 5-point harness. Comfort toy must be in vehicle. Do not discuss school with child during journey."
                />
              </FormField>

              <div>
                <p className="label mb-2">
                  📎 Care plan &amp; supporting documents
                </p>
                <DocumentUploader
                  documents={form.documents || []}
                  onChange={(docs) =>
                    setForm((p) => ({ ...p, documents: docs }))
                  }
                />
              </div>
            </div>
          )}

          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save child
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
