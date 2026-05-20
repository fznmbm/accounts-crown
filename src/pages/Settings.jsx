import { useState, useEffect } from "react";
import { useApp, DEFAULT_SETTINGS } from "../context/AppContext";
import { CONFIG } from "../config";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import { uid } from "../lib/utils";
import DocumentUploader from "../components/DocumentUploader";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { useConfirm } from "../context/ConfirmContext";

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
    attendance,
    allocations,
    holidays,
    billingRecipients,
    setBillingRecipients,
  } = useApp();
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const [saved, setSaved] = useState(false);
  const [newAuthority, setNewAuthority] = useState("");
  const { user, isOwner } = useAuth();
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [membersLoading, setMembersLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) {
      setMembersLoading(false);
      return;
    }
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    const token = key
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem(key))?.access_token;
          } catch {
            return null;
          }
        })()
      : null;
    if (!token) {
      setMembersLoading(false);
      return;
    }
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/workspace_members?owner_user_id=eq.${user.id}&select=*`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        setMembers(Array.isArray(data) ? data : []);
        setMembersLoading(false);
      })
      .catch(() => setMembersLoading(false));
  }, [isOwner, user.id]);

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    const existing = members.find((m) => m.member_email === email);
    if (existing) {
      setInviteStatus("already");
      return;
    }
    setInviteStatus("sending");
    try {
      const { error } = await supabase.from("workspace_members").insert({
        owner_user_id: user.id,
        member_user_id: user.id,
        member_email: email,
        role: "member",
        created_at: Date.now(),
      });
      if (error) throw error;
      setMembers((p) => [
        ...p,
        { owner_user_id: user.id, member_email: email, role: "member" },
      ]);
      setInviteEmail("");
      setInviteStatus("sent");
      setTimeout(() => setInviteStatus(""), 4000);
    } catch (err) {
      setInviteStatus("error:" + (err.message || "Failed"));
    }
  };

  const removeMember = async (email) => {
    const confirmed = await showConfirm({
      title: `Remove ${email}?`,
      message:
        "This will also delete their login account. They will no longer have access.",
      type: "danger",
      confirmLabel: "Remove",
    });
    if (!confirmed) return;
    try {
      // Call Edge Function FIRST — it verifies ownership via DB row, deletes auth user, then deletes DB row
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ memberEmail: email }),
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      // Edge Function handled DB deletion — just update local state
      setMembers((p) => p.filter((m) => m.member_email !== email));
      toast.success(`${email} removed and login deleted.`);
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    }
  };
  const [newTrainingName, setNewTrainingName] = useState("");
  const [newTrainingYears, setNewTrainingYears] = useState(3);

  const showConfirm = useConfirm();

  // ── Billing recipients ────────────────────────────────────────────────────
  const [showBrModal, setShowBrModal] = useState(false);
  const [editingBr, setEditingBr] = useState(null);
  const [brForm, setBrForm] = useState({
    name: "",
    shortName: "",
    address: "",
    email: "",
    phone: "",
    supplierRef: "",
    isDefault: false,
    active: true,
    lastInvoiceNumber: 0,
    notes: "",
  });

  const bf = (k) => (e) => setBrForm((p) => ({ ...p, [k]: e.target.value }));

  const openAddBr = () => {
    setBrForm({
      name: "",
      shortName: "",
      address: "",
      email: "",
      phone: "",
      supplierRef: "",
      isDefault: billingRecipients.length === 0,
      active: true,
      lastInvoiceNumber: 0,
      notes: "",
    });
    setEditingBr(null);
    setShowBrModal(true);
  };

  const openEditBr = (r) => {
    setBrForm({ ...r });
    setEditingBr(r);
    setShowBrModal(true);
  };

  const closeBrModal = () => {
    setShowBrModal(false);
    setEditingBr(null);
  };

  const saveBr = async () => {
    if (!brForm.name?.trim()) return;
    const record = {
      id: editingBr?.id || uid(),
      name: brForm.name.trim(),
      shortName: brForm.shortName?.trim() || "",
      address: brForm.address || "",
      email: brForm.email || "",
      phone: brForm.phone || "",
      supplierRef: brForm.supplierRef || "",
      isDefault: brForm.isDefault || false,
      active: brForm.active ?? true,
      lastInvoiceNumber: Number(brForm.lastInvoiceNumber) || 0,
      notes: brForm.notes || "",
      createdAt: editingBr?.createdAt || Date.now(),
    };
    let updated = editingBr
      ? billingRecipients.map((r) => (r.id === editingBr.id ? record : r))
      : [...billingRecipients, record];
    // Ensure only one default
    if (record.isDefault)
      updated = updated.map((r) =>
        r.id === record.id ? r : { ...r, isDefault: false },
      );
    await setBillingRecipients(updated);
    toast.success(editingBr ? "Recipient updated." : "Recipient added.");
    closeBrModal();
  };

  const deleteBr = async (id) => {
    const r = billingRecipients.find((x) => x.id === id);
    const confirmed = await showConfirm({
      title: `Delete ${r?.name}?`,
      message:
        "Existing invoices and routes will keep their data — only the recipient record is removed.",
      type: "danger",
      confirmLabel: "Delete",
    });
    if (confirmed) {
      await setBillingRecipients(billingRecipients.filter((x) => x.id !== id));
      toast.success("Recipient deleted.");
    }
  };

  const setAsDefault = async (id) => {
    const updated = billingRecipients.map((r) => ({
      ...r,
      isDefault: r.id === id,
    }));
    await setBillingRecipients(updated);
    toast.success("Default billing recipient updated.");
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const save = () => {
    setSettings({ ...form, vatRate: Number(form.vatRate) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const reset = async () => {
    const confirmed = await showConfirm({
      title: "Reset all settings to defaults?",
      message: "Your current settings will be overwritten.",
      type: "warning",
      confirmLabel: "Reset",
    });
    if (confirmed) {
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

      <div className="flex-1 overflow-y-auto p-6 pb-6">
        <div className="max-w-3xl mx-auto space-y-6">
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
                  placeholder="e.g. 123456789"
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
            <FormField label="Supplier Reference">
              <input
                className="input font-mono w-48"
                value={form.supplierNumber}
                onChange={f("supplierNumber")}
                placeholder="e.g. 000000"
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
                  placeholder="e.g. 00-00-00"
                />
              </FormField>
              <FormField label="Account number">
                <input
                  className="input font-mono"
                  value={form.accountNo}
                  onChange={f("accountNo")}
                  placeholder="e.g. 00000000"
                />
              </FormField>
            </FormGrid>
          </div>

          {/* Billing Recipients */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="section-title">Billing recipients</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Who you invoice — each recipient has their own supplier
                  reference and invoice number sequence.
                </p>
              </div>
              <button className="btn-primary text-sm" onClick={openAddBr}>
                + Add recipient
              </button>
            </div>

            {billingRecipients.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No billing recipients yet.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Add your main client — e.g. West Sussex County Council
                </p>
                <button
                  className="btn-primary text-sm mt-2"
                  onClick={openAddBr}
                >
                  Add first recipient
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {billingRecipients.map((r) => (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border ${
                      r.isDefault
                        ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {r.name}
                          </p>
                          {r.shortName && (
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {r.shortName}
                            </span>
                          )}
                          {r.isDefault && (
                            <span className="chip-green text-xs">Default</span>
                          )}
                          {!r.active && (
                            <span className="chip-red text-xs">Inactive</span>
                          )}
                        </div>
                        {r.address && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">
                            {r.address}
                          </p>
                        )}
                        <div className="flex gap-4 mt-1.5 flex-wrap">
                          {r.supplierRef && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Supplier ref:{" "}
                              <span className="font-mono font-medium">
                                {r.supplierRef}
                              </span>
                            </p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Invoice sequence: #{r.lastInvoiceNumber || 0}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!r.isDefault && (
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => setAsDefault(r.id)}
                          >
                            Set default
                          </button>
                        )}
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => openEditBr(r)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => deleteBr(r.id)}
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

          {/* Team members */}
          {isOwner && (
            <div className="card p-5 space-y-4">
              <h2 className="section-title pb-2 border-b border-gray-100 dark:border-gray-700">
                Team members
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add team members who need access. After adding, share the signup
                link with them — they sign up with the exact email you entered
                and will automatically see your data.
              </p>

              {/* Current members */}
              {membersLoading ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Loading…
                </p>
              ) : members.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No team members added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400">
                          {m.member_email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            {m.member_email}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                            {m.role}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMember(m.member_email)}
                        className="text-xs text-red-500 dark:text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Invite form */}
              <div className="flex gap-2 pt-1">
                <input
                  className="input flex-1"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="office@example.com"
                  onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                />
                <button
                  className="btn-secondary text-sm"
                  onClick={inviteMember}
                >
                  + Add
                </button>
              </div>
              {inviteStatus === "sent" && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ Team member added. They can now sign up with this email.
                </p>
              )}
              {inviteStatus === "already" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠ This email is already in your team.
                </p>
              )}
              {inviteStatus.startsWith("error") && (
                <p className="text-xs text-red-500 dark:text-red-400">
                  {inviteStatus.replace("error:", "")}
                </p>
              )}

              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                ℹ After adding, share the signup link with your team member:{" "}
                <span className="font-mono">
                  {window.location.origin}/signup
                </span>
                . They must sign up with the exact email address you entered.
              </div>
            </div>
          )}

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
                    attendance,
                    allocations,
                    holidays,
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
                  a.click();
                }}
              >
                ↓ Export backup (JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Recipient Modal */}
      {showBrModal && (
        <Modal
          title={editingBr ? "Edit billing recipient" : "Add billing recipient"}
          onClose={closeBrModal}
          size="md"
        >
          <div className="space-y-4">
            <FormField label="Recipient name *">
              <input
                className="input"
                value={brForm.name}
                onChange={bf("name")}
                placeholder="e.g. West Sussex County Council"
                autoFocus
              />
            </FormField>
            <FormField
              label="Short name"
              hint="Abbreviation used in labels and charts (e.g. WSCC)"
            >
              <input
                className="input w-40"
                value={brForm.shortName || ""}
                onChange={bf("shortName")}
                placeholder="e.g. WSCC"
              />
            </FormField>
            <FormField label="Address">
              <textarea
                className="input"
                rows={3}
                value={brForm.address}
                onChange={bf("address")}
                placeholder={"Street\nTown\nCounty\nPostcode"}
              />
            </FormField>
            <FormGrid cols={2}>
              <FormField label="Email">
                <input
                  className="input"
                  type="email"
                  value={brForm.email}
                  onChange={bf("email")}
                  placeholder="accounts@example.gov.uk"
                />
              </FormField>
              <FormField label="Phone">
                <input
                  className="input"
                  value={brForm.phone}
                  onChange={bf("phone")}
                />
              </FormField>
            </FormGrid>
            <FormField
              label="Supplier reference"
              hint="The reference number they assign to you"
            >
              <input
                className="input font-mono w-48"
                value={brForm.supplierRef}
                onChange={bf("supplierRef")}
                placeholder="e.g. 000000"
              />
            </FormField>
            <FormField
              label="Starting invoice number"
              hint="Next invoice generated will be this + 1"
            >
              <input
                className="input font-mono w-40"
                type="number"
                min="0"
                value={brForm.lastInvoiceNumber}
                onChange={bf("lastInvoiceNumber")}
              />
            </FormField>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={brForm.isDefault || false}
                  onChange={(e) =>
                    setBrForm((p) => ({ ...p, isDefault: e.target.checked }))
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Set as default billing recipient
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={brForm.active ?? true}
                  onChange={(e) =>
                    setBrForm((p) => ({ ...p, active: e.target.checked }))
                  }
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Active
                </span>
              </label>
            </div>
            <FormField label="Notes">
              <input
                className="input"
                value={brForm.notes}
                onChange={bf("notes")}
                placeholder="Any notes about this client…"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={closeBrModal}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={saveBr}
              disabled={!brForm.name?.trim()}
            >
              {editingBr ? "Save changes" : "Add recipient"}
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
