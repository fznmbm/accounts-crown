import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { uid, fmtD } from "../lib/utils";

const DEFAULT_TRAINING_TYPES = [
  "Safeguarding",
  "Disability Awareness",
  "Challenging Behaviour",
];

const AUTHORITIES = [
  "Crawley",
  "Mid Sussex",
  "Reigate & Banstead",
  "Horsham",
  "Worthing",
  "Adur",
  "Arun",
  "Chichester",
  "Eastbourne",
  "Hastings",
  "Lewes",
  "Rother",
  "Wealden",
  "Other",
];

// ── Expiry helpers ────────────────────────────────────────────────────────────
function getExpiryStatus(dateStr) {
  if (!dateStr) return { status: "missing", daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr);
  expiry.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((expiry - today) / 86400000);
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= 30) return { status: "critical", daysLeft };
  if (daysLeft <= 60) return { status: "warning", daysLeft };
  return { status: "ok", daysLeft };
}

function ExpiryBadge({ date, label }) {
  const s = getExpiryStatus(date);
  const cls = {
    expired:
      "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400",
    critical:
      "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400",
    warning:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    ok: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    missing:
      "bg-gray-100  dark:bg-gray-700      text-gray-500  dark:text-gray-400",
  };
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls[s.status]}`}
      >
        {!date ? (
          "Not set"
        ) : (
          <>
            {(s.status === "expired" || s.status === "critical") && "⚠ "}
            {s.status === "ok" && "✓ "}
            {fmtD(date)}
            <span className="opacity-70 ml-1">
              {s.status === "expired"
                ? `(${Math.abs(s.daysLeft)}d ago)`
                : s.status === "missing"
                  ? ""
                  : `(${s.daysLeft}d)`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function getWorstStatus(statuses) {
  if (
    statuses.some((s) => s === "expired" || s === "critical" || s === "missing")
  )
    return "red";
  if (statuses.some((s) => s === "warning")) return "amber";
  if (statuses.length === 0 || statuses.every((s) => s === "ok"))
    return statuses.length === 0 ? "gray" : "green";
  return "green";
}

const DOT = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-green-500",
  gray: "bg-gray-300 dark:bg-gray-600",
};

// ── Empty forms ───────────────────────────────────────────────────────────────
const EMPTY_LIC = {
  authority: "",
  driverLicenceNumber: "",
  driverLicenceExpiry: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColour: "",
  vehicleRegistration: "",
  vehicleLicenceNumber: "",
  vehicleLicenceExpiry: "",
  insuranceExpiry: "",
  documents: [],
  notes: "",
};
const EMPTY_TRN = {
  trainingType: "",
  renewalYears: 3,
  completedDate: "",
  expiryDate: "",
  certificateUrl: "",
  notes: "",
};

export default function Compliance() {
  const {
    staff,
    staffLicences,
    setStaffLicences,
    staffTraining,
    setStaffTraining,
    settings,
  } = useApp();
  const authorities = settings?.licensingAuthorities || [
    "Crawley",
    "Mid Sussex",
    "Reigate & Banstead",
    "Horsham",
    "Other",
  ];
  const trainingTypes = settings?.trainingTypes || [
    { name: "Safeguarding", renewalYears: 3 },
    { name: "Disability Awareness", renewalYears: 3 },
    { name: "Challenging Behaviour", renewalYears: 3 },
  ];
  const mandatoryTrainingNames = trainingTypes.map((t) => t.name);

  const [tab, setTab] = useState("licences");
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  const [showLicModal, setShowLicModal] = useState(false);
  const [licEditing, setLicEditing] = useState(null);
  const [licForm, setLicForm] = useState(EMPTY_LIC);

  const [showTrnModal, setShowTrnModal] = useState(false);
  const [trnEditing, setTrnEditing] = useState(null);
  const [trnForm, setTrnForm] = useState(EMPTY_TRN);

  const licenceStaff = staff.filter(
    (s) => s.type === "driver" || s.type === "driver_pa",
  );
  const displayStaff = tab === "licences" ? licenceStaff : staff;
  const effectiveSelected = displayStaff.find((s) => s.id === selectedStaffId)
    ? selectedStaffId
    : displayStaff[0]?.id || null;
  const selectedStaff = staff.find((s) => s.id === effectiveSelected);

  // ── Compliance status dots ────────────────────────────────────────────────
  const licStatusMap = useMemo(() => {
    const map = {};
    licenceStaff.forEach((s) => {
      const lics = staffLicences.filter((l) => l.staffId === s.id);
      if (lics.length === 0) {
        map[s.id] = "gray";
        return;
      }
      const statuses = lics.flatMap((l) => [
        getExpiryStatus(l.driverLicenceExpiry).status,
        getExpiryStatus(l.vehicleLicenceExpiry).status,
        getExpiryStatus(l.insuranceExpiry).status,
      ]);
      map[s.id] = getWorstStatus(statuses);
    });
    return map;
  }, [staffLicences, licenceStaff]);

  const trnStatusMap = useMemo(() => {
    const map = {};
    staff.forEach((s) => {
      const trns = staffTraining.filter((t) => t.staffId === s.id);
      if (trns.length === 0) {
        map[s.id] = "gray";
        return;
      }
      map[s.id] = getWorstStatus(
        trns.map((t) => getExpiryStatus(t.expiryDate).status),
      );
    });
    return map;
  }, [staffTraining, staff]);

  // ── Licence CRUD ──────────────────────────────────────────────────────────
  const openAddLic = () => {
    setLicForm({ ...EMPTY_LIC });
    setLicEditing(null);
    setShowLicModal(true);
  };
  const openEditLic = (l) => {
    setLicForm({
      authority: l.authority || "",
      driverLicenceNumber: l.driverLicenceNumber || "",
      driverLicenceExpiry: l.driverLicenceExpiry || "",
      vehicleMake: l.vehicleMake || "",
      vehicleModel: l.vehicleModel || "",
      vehicleColour: l.vehicleColour || "",
      vehicleRegistration: l.vehicleRegistration || "",
      vehicleLicenceNumber: l.vehicleLicenceNumber || "",
      vehicleLicenceExpiry: l.vehicleLicenceExpiry || "",
      insuranceExpiry: l.insuranceExpiry || "",
      documents: l.documents || [],
      notes: l.notes || "",
    });
    setLicEditing(l);
    setShowLicModal(true);
  };
  const saveLic = () => {
    if (!licForm.authority) return;
    const record = {
      id: licEditing?.id || uid(),
      staffId: effectiveSelected,
      ...licForm,
      createdAt: licEditing?.createdAt || Date.now(),
    };
    setStaffLicences(
      licEditing
        ? staffLicences.map((l) => (l.id === licEditing.id ? record : l))
        : [...staffLicences, record],
    );
    setShowLicModal(false);
  };
  const delLic = (id) => {
    if (confirm("Delete this licence record?"))
      setStaffLicences(staffLicences.filter((l) => l.id !== id));
  };

  // ── Training CRUD ─────────────────────────────────────────────────────────
  const openAddTrn = () => {
    setTrnForm({ ...EMPTY_TRN });
    setTrnEditing(null);
    setShowTrnModal(true);
  };
  const openEditTrn = (t) => {
    setTrnForm({
      trainingType: t.trainingType || "",
      renewalYears: t.renewalYears ?? 3,
      completedDate: t.completedDate || "",
      expiryDate: t.expiryDate || "",
      certificateUrl: t.certificateUrl || "",
      notes: t.notes || "",
    });
    setTrnEditing(t);
    setShowTrnModal(true);
  };
  const saveTrn = () => {
    if (!trnForm.trainingType || !trnForm.completedDate) return;
    const d = new Date(trnForm.completedDate);
    d.setFullYear(d.getFullYear() + Number(trnForm.renewalYears));
    const expiryDate = d.toISOString().split("T")[0];
    const record = {
      id: trnEditing?.id || uid(),
      staffId: effectiveSelected,
      ...trnForm,
      expiryDate,
      renewalYears: Number(trnForm.renewalYears),
      createdAt: trnEditing?.createdAt || Date.now(),
    };
    setStaffTraining(
      trnEditing
        ? staffTraining.map((t) => (t.id === trnEditing.id ? record : t))
        : [...staffTraining, record],
    );
    setShowTrnModal(false);
  };
  const delTrn = (id) => {
    if (confirm("Delete this training record?"))
      setStaffTraining(staffTraining.filter((t) => t.id !== id));
  };

  const lf = (k) => (e) => setLicForm((p) => ({ ...p, [k]: e.target.value }));
  const tf = (k) => (e) => setTrnForm((p) => ({ ...p, [k]: e.target.value }));

  const selectedLicences = staffLicences.filter(
    (l) => l.staffId === effectiveSelected,
  );
  const selectedTraining = staffTraining.filter(
    (t) => t.staffId === effectiveSelected,
  );

  // ── Summary counts for header ──────────────────────────────────────────────
  const totalExpired = useMemo(() => {
    const licExpired = staffLicences.filter((l) => {
      const ss = [
        getExpiryStatus(l.driverLicenceExpiry),
        getExpiryStatus(l.vehicleLicenceExpiry),
        getExpiryStatus(l.insuranceExpiry),
      ];
      return ss.some((s) => s.status === "expired" || s.status === "critical");
    }).length;
    const trnExpired = staffTraining.filter((t) => {
      const s = getExpiryStatus(t.expiryDate);
      return s.status === "expired" || s.status === "critical";
    }).length;
    return licExpired + trnExpired;
  }, [staffLicences, staffTraining]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Compliance"
        subtitle={
          totalExpired > 0
            ? `⚠ ${totalExpired} expired or expiring within 30 days`
            : "All records valid"
        }
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setTab("licences")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "licences" ? "bg-blue-600 text-white" : "btn-secondary"}`}
            >
              🪪 Licences & Vehicles
            </button>
            <button
              onClick={() => setTab("training")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "training" ? "bg-blue-600 text-white" : "btn-secondary"}`}
            >
              🎓 Training
            </button>
            <button
              onClick={() => setTab("summary")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "summary" ? "bg-blue-600 text-white" : "btn-secondary"}`}
            >
              📊 Summary
            </button>
          </div>
        }
      />

      {/* ══ SUMMARY TAB ══════════════════════════════════════════════════════ */}
      {tab === "summary" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Licences summary */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="section-title">
                🪪 Driver Licences & Vehicles — All Staff
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {licenceStaff.length} drivers
              </span>
            </div>
            {licenceStaff.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">
                No drivers added yet
              </p>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Driver</th>
                    <th className="th">Authority</th>
                    <th className="th">Driver Licence</th>
                    <th className="th">Vehicle Reg</th>
                    <th className="th">Vehicle Licence</th>
                    <th className="th">Insurance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {licenceStaff.map((s) => {
                    const lics = staffLicences.filter(
                      (l) => l.staffId === s.id,
                    );
                    if (lics.length === 0)
                      return (
                        <tr key={s.id} className="tr">
                          <td className="td font-medium text-gray-900 dark:text-gray-100">
                            {s.name}
                          </td>
                          <td className="td" colSpan={5}>
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                              No licence records
                            </span>
                          </td>
                        </tr>
                      );
                    return lics.map((l, i) => {
                      const ds = getExpiryStatus(l.driverLicenceExpiry);
                      const vs = getExpiryStatus(l.vehicleLicenceExpiry);
                      const ins = getExpiryStatus(l.insuranceExpiry);
                      const badge = (s, date) => {
                        const cls =
                          s.status === "expired" || s.status === "critical"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : s.status === "warning"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : s.status === "ok"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500";
                        const text = !date
                          ? "—"
                          : s.status === "expired"
                            ? `⚠ ${new Date(date).toLocaleDateString("en-GB")}`
                            : new Date(date).toLocaleDateString("en-GB");
                        return (
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
                          >
                            {text}
                          </span>
                        );
                      };
                      return (
                        <tr key={`${s.id}-${i}`} className="tr">
                          {i === 0 && (
                            <td
                              className="td font-medium text-gray-900 dark:text-gray-100"
                              rowSpan={lics.length}
                            >
                              <button
                                className="hover:underline text-left"
                                onClick={() => {
                                  setTab("licences");
                                  setSelectedStaffId(s.id);
                                }}
                              >
                                {s.name}
                              </button>
                            </td>
                          )}
                          <td className="td text-gray-600 dark:text-gray-400 text-xs">
                            {l.authority}
                          </td>
                          <td className="td">
                            {badge(ds, l.driverLicenceExpiry)}
                          </td>
                          <td className="td text-xs font-mono text-gray-600 dark:text-gray-400">
                            {l.vehicleRegistration || "—"}
                          </td>
                          <td className="td">
                            {badge(vs, l.vehicleLicenceExpiry)}
                          </td>
                          <td className="td">
                            {badge(ins, l.insuranceExpiry)}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Training summary */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="section-title">🎓 Training — All Staff</h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {staff.length} staff
              </span>
            </div>
            {staff.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">
                No staff added yet
              </p>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Staff</th>
                    <th className="th">Role</th>
                    {mandatoryTrainingNames.map((t) => (
                      <th key={t} className="th">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {staff.map((s) => (
                    <tr key={s.id} className="tr">
                      <td className="td font-medium text-gray-900 dark:text-gray-100">
                        <button
                          className="hover:underline text-left"
                          onClick={() => {
                            setTab("training");
                            setSelectedStaffId(s.id);
                          }}
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="td text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {s.type?.replace("_", " ")}
                      </td>
                      {mandatoryTrainingNames.map((type) => {
                        const rec = staffTraining.find(
                          (t) => t.staffId === s.id && t.trainingType === type,
                        );
                        const es = rec ? getExpiryStatus(rec.expiryDate) : null;
                        const cls = !rec
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                          : es.status === "expired" || es.status === "critical"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : es.status === "warning"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                              : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
                        const text = !rec
                          ? "—"
                          : es.status === "expired"
                            ? `⚠ Expired`
                            : es.status === "critical"
                              ? `⚠ ${es.daysLeft}d`
                              : es.status === "warning"
                                ? `${es.daysLeft}d`
                                : `✓ ${new Date(rec.expiryDate).toLocaleDateString("en-GB")}`;
                        return (
                          <td key={type} className="td">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
                            >
                              {text}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div
        className={`flex flex-1 overflow-hidden ${tab === "summary" ? "hidden" : ""}`}
      >
        {/* ── Left: staff list ─────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              {tab === "licences"
                ? `Drivers (${licenceStaff.length})`
                : `All staff (${staff.length})`}
            </p>
          </div>
          {displayStaff.length === 0 ? (
            <p className="p-4 text-sm text-gray-400 dark:text-gray-500 text-center">
              No staff added yet
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {displayStaff.map((s) => {
                const dot =
                  tab === "licences"
                    ? licStatusMap[s.id] || "gray"
                    : trnStatusMap[s.id] || "gray";
                const count =
                  tab === "licences"
                    ? staffLicences.filter((l) => l.staffId === s.id).length
                    : staffTraining.filter((t) => t.staffId === s.id).length;
                const isSelected = s.id === effectiveSelected;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffId(s.id)}
                    className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[dot]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {s.type?.replace("_", " ")} · {count} record
                        {count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: detail ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!effectiveSelected ? (
            <EmptyState
              icon="👈"
              title="Select a staff member"
              description="Choose from the list to view compliance records."
            />
          ) : tab === "licences" ? (
            /* ══ LICENCES TAB ══════════════════════════════════════════ */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaff?.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {selectedStaff?.type?.replace("_", " ")} — Licences &amp;
                    Vehicles
                  </p>
                </div>
                <button className="btn-primary" onClick={openAddLic}>
                  + Add licence
                </button>
              </div>

              {selectedLicences.length === 0 ? (
                <EmptyState
                  icon="🪪"
                  title="No licences recorded"
                  description="Add a record for each licensing authority this driver operates under."
                  action={
                    <button className="btn-primary" onClick={openAddLic}>
                      Add first licence
                    </button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {selectedLicences.map((l) => (
                    <div key={l.id} className="card p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {l.authority}
                        </h3>
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost text-sm"
                            onClick={() => openEditLic(l)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-ghost text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => delLic(l.id)}
                          >
                            Del
                          </button>
                        </div>
                      </div>

                      {/* Driver licence section */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          🪪 Taxi Driver Licence
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Licence number
                            </p>
                            <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                              {l.driverLicenceNumber || "—"}
                            </p>
                          </div>
                          <ExpiryBadge
                            date={l.driverLicenceExpiry}
                            label="Expiry"
                          />
                        </div>
                      </div>

                      {/* Vehicle section */}
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700 space-y-3">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          🚗 Vehicle
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Make & Model
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                              {[l.vehicleMake, l.vehicleModel]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Colour
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                              {l.vehicleColour || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Registration
                            </p>
                            <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 mt-0.5 uppercase">
                              {l.vehicleRegistration || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Vehicle licence no.
                            </p>
                            <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                              {l.vehicleLicenceNumber || "—"}
                            </p>
                          </div>
                          <ExpiryBadge
                            date={l.vehicleLicenceExpiry}
                            label="Vehicle licence expiry"
                          />
                          <ExpiryBadge
                            date={l.insuranceExpiry}
                            label="Insurance expiry"
                          />
                        </div>
                      </div>

                      {l.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          {l.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ══ TRAINING TAB ══════════════════════════════════════════ */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaff?.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {selectedStaff?.type?.replace("_", " ")} — Mandatory
                    Training
                  </p>
                </div>
                <button className="btn-primary" onClick={openAddTrn}>
                  + Add training
                </button>
              </div>

              {/* Mandatory training checklist */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Mandatory training status
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {mandatoryTrainingNames.map((type) => {
                    const rec = selectedTraining.find(
                      (t) => t.trainingType === type,
                    );
                    const s = rec ? getExpiryStatus(rec.expiryDate) : null;
                    const bgCls = !rec
                      ? "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      : s.status === "expired" || s.status === "critical"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : s.status === "warning"
                          ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                          : "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800";
                    return (
                      <div
                        key={type}
                        className={`p-3 rounded-lg border ${bgCls}`}
                      >
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          {type}
                        </p>
                        {rec ? (
                          <>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Done: {fmtD(rec.completedDate)}
                            </p>
                            <p
                              className={`text-xs font-medium mt-0.5 ${
                                s.status === "expired" ||
                                s.status === "critical"
                                  ? "text-red-600 dark:text-red-400"
                                  : s.status === "warning"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-green-600 dark:text-green-400"
                              }`}
                            >
                              {s.status === "expired"
                                ? `⚠ Expired ${Math.abs(s.daysLeft)}d ago`
                                : s.status === "critical"
                                  ? `⚠ ${s.daysLeft}d left`
                                  : s.status === "warning"
                                    ? `${s.daysLeft}d left`
                                    : `✓ ${s.daysLeft}d left`}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            Not recorded
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedTraining.length === 0 ? (
                <EmptyState
                  icon="🎓"
                  title="No training records"
                  description="Add training completions to track renewals and get expiry alerts."
                  action={
                    <button className="btn-primary" onClick={openAddTrn}>
                      Add first record
                    </button>
                  }
                />
              ) : (
                <div className="card overflow-hidden">
                  <table className="min-w-full">
                    <thead>
                      <tr className="thead-row">
                        <th className="th">Training type</th>
                        <th className="th">Completed</th>
                        <th className="th">Expires</th>
                        <th className="th">Renews every</th>
                        <th className="th">Status</th>
                        <th className="th">Certificate</th>
                        <th className="th"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {[...selectedTraining]
                        .sort((a, b) =>
                          a.trainingType.localeCompare(b.trainingType),
                        )
                        .map((t) => {
                          const s = getExpiryStatus(t.expiryDate);
                          return (
                            <tr key={t.id} className="tr">
                              <td className="td font-medium text-gray-900 dark:text-gray-100">
                                {t.trainingType}
                              </td>
                              <td className="td text-gray-600 dark:text-gray-400">
                                {fmtD(t.completedDate)}
                              </td>
                              <td className="td text-gray-600 dark:text-gray-400">
                                {fmtD(t.expiryDate)}
                              </td>
                              <td className="td text-gray-500 dark:text-gray-400">
                                {t.renewalYears}yr
                                {t.renewalYears !== 1 ? "s" : ""}
                              </td>
                              <td className="td">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    s.status === "expired"
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                      : s.status === "critical"
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        : s.status === "warning"
                                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                  }`}
                                >
                                  {s.status === "expired"
                                    ? `⚠ Expired`
                                    : s.status === "critical"
                                      ? `⚠ ${s.daysLeft}d left`
                                      : s.status === "warning"
                                        ? `${s.daysLeft}d left`
                                        : `✓ Valid`}
                                </span>
                              </td>
                              <td className="td">
                                {t.certificateUrl ? (
                                  <a
                                    href={t.certificateUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="td">
                                <div className="flex gap-1">
                                  <button
                                    className="btn-ghost text-xs"
                                    onClick={() => openEditTrn(t)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => delTrn(t.id)}
                                  >
                                    Del
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ Licence modal ════════════════════════════════════════════════════ */}
      {showLicModal && (
        <Modal
          title={licEditing ? "Edit licence record" : "Add licence record"}
          onClose={() => setShowLicModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            <FormField label="Licensing authority *">
              <input
                className="input"
                list="authorities-list"
                value={licForm.authority}
                onChange={lf("authority")}
                placeholder="e.g. Crawley, Mid Sussex…"
              />
              <datalist id="authorities-list">
                {authorities.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </FormField>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">🪪 Taxi Driver Licence</p>
              <FormGrid cols={2}>
                <FormField label="Driver licence number">
                  <input
                    className="input font-mono"
                    value={licForm.driverLicenceNumber}
                    onChange={lf("driverLicenceNumber")}
                    placeholder="e.g. BD1234"
                  />
                </FormField>
                <FormField label="Driver licence expiry">
                  <input
                    className="input"
                    type="date"
                    value={licForm.driverLicenceExpiry}
                    onChange={lf("driverLicenceExpiry")}
                  />
                </FormField>
              </FormGrid>
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">🚗 Vehicle Details</p>
              <FormGrid cols={3}>
                <FormField label="Make">
                  <input
                    className="input"
                    value={licForm.vehicleMake}
                    onChange={lf("vehicleMake")}
                    placeholder="Toyota"
                  />
                </FormField>
                <FormField label="Model">
                  <input
                    className="input"
                    value={licForm.vehicleModel}
                    onChange={lf("vehicleModel")}
                    placeholder="Prius"
                  />
                </FormField>
                <FormField label="Colour">
                  <input
                    className="input"
                    value={licForm.vehicleColour}
                    onChange={lf("vehicleColour")}
                    placeholder="Silver"
                  />
                </FormField>
              </FormGrid>
              <FormGrid cols={3}>
                <FormField label="Registration">
                  <input
                    className="input font-mono"
                    value={licForm.vehicleRegistration}
                    onChange={(e) =>
                      setLicForm((p) => ({
                        ...p,
                        vehicleRegistration: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="AB12 CDE"
                  />
                </FormField>
                <FormField label="Vehicle licence number">
                  <input
                    className="input font-mono"
                    value={licForm.vehicleLicenceNumber}
                    onChange={lf("vehicleLicenceNumber")}
                    placeholder="e.g. P0123"
                  />
                </FormField>
                <FormField label="Vehicle licence expiry">
                  <input
                    className="input"
                    type="date"
                    value={licForm.vehicleLicenceExpiry}
                    onChange={lf("vehicleLicenceExpiry")}
                  />
                </FormField>
              </FormGrid>
              <FormGrid cols={2}>
                <FormField label="Insurance expiry">
                  <input
                    className="input"
                    type="date"
                    value={licForm.insuranceExpiry}
                    onChange={lf("insuranceExpiry")}
                  />
                </FormField>
              </FormGrid>
            </div>

            <FormField label="Notes">
              <input
                className="input"
                value={licForm.notes}
                onChange={lf("notes")}
                placeholder="Any additional notes…"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowLicModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={saveLic}
              disabled={!licForm.authority}
            >
              Save licence
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* ══ Training modal ═══════════════════════════════════════════════════ */}
      {showTrnModal && (
        <Modal
          title={trnEditing ? "Edit training record" : "Add training record"}
          onClose={() => setShowTrnModal(false)}
          size="md"
        >
          <div className="space-y-4">
            <FormField
              label="Training type *"
              hint="Select a standard type or type your own"
            >
              <input
                className="input"
                list="training-types-list"
                value={trnForm.trainingType}
                onChange={tf("trainingType")}
                placeholder="e.g. Safeguarding, First Aid…"
              />
              <datalist id="training-types-list">
                {trainingTypes.map((t) => (
                  <option key={t.name} value={t.name} />
                ))}
              </datalist>
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Completed date *">
                <input
                  className="input"
                  type="date"
                  value={trnForm.completedDate}
                  onChange={tf("completedDate")}
                />
              </FormField>
              <FormField label="Renewal period (years)">
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={trnForm.renewalYears}
                  onChange={tf("renewalYears")}
                />
              </FormField>
            </FormGrid>
            {trnForm.completedDate && (
              <div className="alert-info text-xs text-blue-700 dark:text-blue-400">
                ℹ Expiry will be automatically set to:{" "}
                {(() => {
                  const d = new Date(trnForm.completedDate);
                  d.setFullYear(d.getFullYear() + Number(trnForm.renewalYears));
                  return d.toLocaleDateString("en-GB");
                })()}
              </div>
            )}
            <FormField
              label="Certificate URL"
              hint="Paste a Google Drive link or any URL"
            >
              <input
                className="input"
                value={trnForm.certificateUrl}
                onChange={tf("certificateUrl")}
                placeholder="https://drive.google.com/…"
              />
            </FormField>
            <FormField label="Notes">
              <input
                className="input"
                value={trnForm.notes}
                onChange={tf("notes")}
                placeholder="Any notes…"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowTrnModal(false)}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={saveTrn}
              disabled={!trnForm.trainingType || !trnForm.completedDate}
            >
              Save training
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
