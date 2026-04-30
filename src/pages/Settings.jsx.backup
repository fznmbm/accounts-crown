import { useState } from "react";
import { useApp, DEFAULT_SETTINGS } from "../context/AppContext";
import { CONFIG } from "../config";
import PageHeader from "../components/PageHeader";
import { FormField, FormGrid } from "../components/Modal";
//import { uid } from "../lib/utils";
import DocumentUploader from "../components/DocumentUploader";

// function MigrateButton() {
//   const {
//     setRoutes,
//     setInvoices,
//     setStaff,
//     setPayments,
//     setRemittances,
//     setSettings,
//     routes,
//     invoices,
//     staff,
//     payments,
//     remittances,
//   } = useApp();
//   const [status, setStatus] = useState("");
//   const [running, setRunning] = useState(false);

//   const migrate = async () => {
//     setRunning(true);
//     setStatus("Reading localStorage…");
//     try {
//       const lsRoutes = JSON.parse(localStorage.getItem("cc_routes_v2") || "[]");
//       const lsInvoices = JSON.parse(
//         localStorage.getItem("cc_invoices_v2") || "[]",
//       );
//       const lsStaff = JSON.parse(localStorage.getItem("cc_staff_v2") || "[]");
//       const lsPayments = JSON.parse(
//         localStorage.getItem("cc_payments_v2") || "[]",
//       );
//       const lsRemittances = JSON.parse(
//         localStorage.getItem("cc_remittances_v2") || "[]",
//       );
//       const lsSettings = JSON.parse(
//         localStorage.getItem("cc_settings_v1") || "null",
//       );

//       const total =
//         lsRoutes.length +
//         lsInvoices.length +
//         lsStaff.length +
//         lsPayments.length +
//         lsRemittances.length;
//       if (total === 0) {
//         setStatus("No localStorage data found — nothing to migrate.");
//         setRunning(false);
//         return;
//       }

//       setStatus(`Found ${total} records. Merging…`);

//       // Merge — skip duplicates by id
//       const existingRouteIds = new Set(routes.map((x) => x.id));
//       const existingInvoiceIds = new Set(invoices.map((x) => x.id));
//       const existingStaffIds = new Set(staff.map((x) => x.id));
//       const existingPaymentIds = new Set(payments.map((x) => x.id));
//       const existingRemittanceIds = new Set(remittances.map((x) => x.id));

//       const newRoutes = lsRoutes.filter((x) => !existingRouteIds.has(x.id));
//       const newInvoices = lsInvoices.filter(
//         (x) => !existingInvoiceIds.has(x.id),
//       );
//       const newStaff = lsStaff.filter((x) => !existingStaffIds.has(x.id));
//       const newPayments = lsPayments.filter(
//         (x) => !existingPaymentIds.has(x.id),
//       );
//       const newRemittances = lsRemittances.filter(
//         (x) => !existingRemittanceIds.has(x.id),
//       );

//       setStatus("Saving to Supabase…");

//       if (newRoutes.length) await setRoutes([...routes, ...newRoutes]);
//       if (newInvoices.length) await setInvoices([...invoices, ...newInvoices]);
//       if (newStaff.length) await setStaff([...staff, ...newStaff]);
//       if (newPayments.length) await setPayments([...payments, ...newPayments]);
//       if (newRemittances.length)
//         await setRemittances([...remittances, ...newRemittances]);
//       if (lsSettings) await setSettings(lsSettings);

//       setStatus(
//         `✓ Migrated: ${newRoutes.length} routes, ${newInvoices.length} invoices, ` +
//           `${newStaff.length} staff, ${newPayments.length} payments, ${newRemittances.length} remittances.`,
//       );
//     } catch (e) {
//       setStatus("Error: " + e.message);
//     }
//     setRunning(false);
//   };

//   return (
//     <div className="space-y-2">
//       <button
//         className="btn-secondary text-sm"
//         onClick={migrate}
//         disabled={running}
//       >
//         {running ? "Migrating…" : "↑ Migrate localStorage → Supabase"}
//       </button>
//       {status && (
//         <p
//           className={`text-xs ${status.startsWith("✓") ? "text-green-600 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}
//         >
//           {status}
//         </p>
//       )}
//     </div>
//   );
// }

export default function Settings() {
  const {
    settings,
    setSettings,
    routes,
    invoices,
    staff,
    payments,
    remittances,
  } = useApp();
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const [saved, setSaved] = useState(false);
  const [newAuthority, setNewAuthority] = useState("");
  const [newTrainingName, setNewTrainingName] = useState("");
  const [newTrainingYears, setNewTrainingYears] = useState(3);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = () => {
    setSettings({ ...form, vatRate: Number(form.vatRate) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const reset = () => {
    if (confirm("Reset all settings to defaults?")) {
      setForm({ ...DEFAULT_SETTINGS });
      setSettings({ ...DEFAULT_SETTINGS });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Settings"
        subtitle="Company details, tax and bank information"
        actions={
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Saved
              </span>
            )}
            <button className="btn-secondary text-sm" onClick={reset}>
              Reset defaults
            </button>
            <button className="btn-primary" onClick={save}>
              Save settings
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Company info */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Company information
            </h2>
            <FormField label="Company name">
              <input
                className="input"
                value={form.companyName}
                onChange={f("companyName")}
              />
            </FormField>
            <FormField label="Address">
              <textarea
                className="input"
                rows={2}
                value={form.address}
                onChange={f("address")}
              />
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Phone">
                <input
                  className="input"
                  value={form.phone}
                  onChange={f("phone")}
                />
              </FormField>
              <FormField label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={f("email")}
                />
              </FormField>
            </FormGrid>
          </div>

          {/* Logo */}
          {/* Logo */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Company logo
            </h2>
            <div className="flex items-center gap-5">
              {/* Preview */}
              <div className="flex-shrink-0">
                {form.logoUrl ? (
                  <>
                    <img
                      src={form.logoUrl}
                      alt="Logo"
                      className="h-16 w-16 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1"
                      onError={(e) => {
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                    <div
                      style={{
                        display: "none",
                        background: CONFIG.primaryColour,
                      }}
                      className="h-16 w-16 rounded-xl items-center justify-center text-white font-bold text-lg"
                    >
                      {CONFIG.companyInitials}
                    </div>
                  </>
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ background: CONFIG.primaryColour }}
                  >
                    {CONFIG.companyInitials}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <DocumentUploader
                  documents={
                    form.logoUrl ? [{ url: form.logoUrl, name: "Logo" }] : []
                  }
                  onChange={(docs) =>
                    setForm((p) => ({ ...p, logoUrl: docs[0]?.url || "" }))
                  }
                  maxFiles={1}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                />
                <FormField label="Or paste image URL directly">
                  <input
                    className="input text-sm"
                    value={form.logoUrl || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, logoUrl: e.target.value }))
                    }
                    placeholder="https://res.cloudinary.com/..."
                  />
                </FormField>
                {form.logoUrl && (
                  <button
                    className="btn-ghost text-xs text-red-500 dark:text-red-400"
                    onClick={() => setForm((p) => ({ ...p, logoUrl: "" }))}
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>
            <p className="muted text-xs">
              Logo is saved to your account settings. Recommended: square image,
              minimum 200×200px, PNG or JPG.
            </p>
          </div>

          {/* Tax / WSCC */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Tax &amp; council details
            </h2>
            <FormGrid cols={2}>
              <FormField label="VAT registration number">
                <input
                  className="input font-mono"
                  value={form.vatNumber}
                  onChange={f("vatNumber")}
                  placeholder="329462388"
                />
              </FormField>
              <FormField label="VAT rate (%)">
                <input
                  className="input"
                  type="number"
                  value={form.vatRate}
                  onChange={f("vatRate")}
                  placeholder="20"
                />
              </FormField>
            </FormGrid>
            <FormField label="WSCC supplier number">
              <input
                className="input font-mono w-48"
                value={form.supplierNumber}
                onChange={f("supplierNumber")}
                placeholder="103820"
              />
            </FormField>
          </div>

          {/* Bank details */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Bank details
            </h2>
            <FormField label="Account name">
              <input
                className="input"
                value={form.accountName}
                onChange={f("accountName")}
              />
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Sort code">
                <input
                  className="input font-mono"
                  value={form.sortCode}
                  onChange={f("sortCode")}
                  placeholder="30-99-50"
                />
              </FormField>
              <FormField label="Account number">
                <input
                  className="input font-mono"
                  value={form.accountNo}
                  onChange={f("accountNo")}
                  placeholder="48755760"
                />
              </FormField>
            </FormGrid>
          </div>

          {/* Licensing authorities */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Licensing authorities
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Used in Compliance page when adding driver licences.
            </p>
            <div className="flex flex-wrap gap-2">
              {(form.licensingAuthorities || []).map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full"
                >
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {a}
                  </span>
                  <button
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        licensingAuthorities: p.licensingAuthorities.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-1 text-xs leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={newAuthority}
                onChange={(e) => setNewAuthority(e.target.value)}
                placeholder="e.g. Brighton & Hove"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAuthority.trim()) {
                    setForm((p) => ({
                      ...p,
                      licensingAuthorities: [
                        ...(p.licensingAuthorities || []),
                        newAuthority.trim(),
                      ],
                    }));
                    setNewAuthority("");
                  }
                }}
              />
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  if (!newAuthority.trim()) return;
                  setForm((p) => ({
                    ...p,
                    licensingAuthorities: [
                      ...(p.licensingAuthorities || []),
                      newAuthority.trim(),
                    ],
                  }));
                  setNewAuthority("");
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Training types */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Training types
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mandatory and optional training courses tracked in Compliance.
            </p>
            <div className="space-y-2">
              {(form.trainingTypes || []).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                    {t.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Every {t.renewalYears}yr{t.renewalYears !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        trainingTypes: p.trainingTypes.filter(
                          (_, j) => j !== i,
                        ),
                      }))
                    }
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <p className="label mb-1">Training name</p>
                <input
                  className="input"
                  value={newTrainingName}
                  onChange={(e) => setNewTrainingName(e.target.value)}
                  placeholder="e.g. First Aid"
                />
              </div>
              <div className="w-28">
                <p className="label mb-1">Renewal (years)</p>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={newTrainingYears}
                  onChange={(e) => setNewTrainingYears(Number(e.target.value))}
                />
              </div>
              <button
                className="btn-secondary text-sm mb-0.5"
                onClick={() => {
                  if (!newTrainingName.trim()) return;
                  setForm((p) => ({
                    ...p,
                    trainingTypes: [
                      ...(p.trainingTypes || []),
                      {
                        name: newTrainingName.trim(),
                        renewalYears: newTrainingYears,
                      },
                    ],
                  }));
                  setNewTrainingName("");
                  setNewTrainingYears(3);
                }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Cloudinary file storage */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              File storage (Cloudinary)
            </h2>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-semibold">Setup instructions:</p>
              <p>
                1. Create a free account at{" "}
                <span className="font-mono">cloudinary.com</span> (25GB free)
              </p>
              <p>
                2. Go to Settings → Upload → Add upload preset → set to{" "}
                <strong>Unsigned</strong>
              </p>
              <p>3. Copy your Cloud Name and Upload Preset name below</p>
            </div>
            <FormGrid cols={2}>
              <FormField label="Cloud name" hint="e.g. my-taxi-company">
                <input
                  className="input font-mono"
                  value={form.cloudinaryCloudName || ""}
                  onChange={f("cloudinaryCloudName")}
                  placeholder="your-cloud-name"
                />
              </FormField>
              <FormField label="Upload preset" hint="Must be set to Unsigned">
                <input
                  className="input font-mono"
                  value={form.cloudinaryUploadPreset || ""}
                  onChange={f("cloudinaryUploadPreset")}
                  placeholder="your-upload-preset"
                />
              </FormField>
            </FormGrid>
            {form.cloudinaryCloudName && form.cloudinaryUploadPreset ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                ✓ Cloudinary configured — file uploads are enabled
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ File uploads disabled until Cloudinary is configured
              </p>
            )}
          </div>

          {/* Data management */}

          {/* Data management */}
          <div className="card p-5 space-y-4">
            <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
              Data
            </h2>

            {/* Export backup */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Export backup
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Download all your Supabase data as a JSON backup file.
              </p>
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  const data = {
                    exportedAt: new Date().toISOString(),
                    routes,
                    invoices,
                    staff,
                    payments,
                    remittances,
                    settings,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `crown-cars-backup-${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                }}
              >
                ↓ Export backup (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
