import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { fmt, fmtD } from "../lib/utils";

const PLANS = ["trial", "starter", "standard", "pro", "owner"];
const STATUSES = ["active", "suspended", "expired"];

const STATUS_STYLE = {
  active: "chip-green",
  suspended: "chip-red",
  expired: "chip-amber",
};

const PLAN_STYLE = {
  trial: "chip-gray",
  starter: "chip-blue",
  standard: "chip-blue",
  pro: "chip-blue",
  owner: "chip-green",
};

const EMPTY = {
  client_name: "",
  licence_key: "",
  status: "active",
  plan: "standard",
  expires_at: "",
  domain: "",
  contact_email: "",
  notes: "",
};

function generateKey(name) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .slice(0, 12);
  const rand = Math.random().toString(36).substr(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `${slug}-${year}-${rand}`;
}

export default function AdminLicences() {
  const [licences, setLicences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const showConfirm = useConfirm();

  // Only the platform owner sees this page. The database (RLS policy
  // platform_admin_write) is what actually enforces it.
  const PLATFORM_ADMIN_ID = import.meta.env.VITE_PLATFORM_ADMIN_USER_ID;
  const isPlatformAdmin = !!PLATFORM_ADMIN_ID && user?.id === PLATFORM_ADMIN_ID;

  const loadLicences = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("licences")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("licences load failed:", error);
      toast.error("Licences didn't load. Refresh to try again.");
    }
    setLicences(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isPlatformAdmin) loadLicences();
  }, [isPlatformAdmin]);

  // Runs one change. A change blocked by RLS returns no rows rather than an
  // error, so "0 rows" is treated as a failure too.
  const run = async (query, successMsg) => {
    const { data, error } = await query.select("id");
    if (error || !data?.length) {
      console.error("licence change failed:", error);
      toast.error(
        error
          ? `Not saved: ${error.message}`
          : "Not saved — you don't have permission.",
      );
      return false;
    }
    toast.success(successMsg);
    await loadLicences();
    return true;
  };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (l) => {
    setForm({ ...l });
    setEditing(l);
    setShowModal(true);
  };

  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = async () => {
    if (!form.client_name || !form.licence_key) return;
    setSaving(true);
    const record = {
      ...form,
      id: editing?.id || `client-${Date.now()}`,
      created_at: editing?.created_at || Date.now(),
    };
    const ok = editing
      ? await run(
          supabase.from("licences").update(record).eq("id", editing.id),
          "Licence updated.",
        )
      : await run(supabase.from("licences").insert(record), "Licence added.");
    setSaving(false);
    if (ok) close(); // on failure the form stays open with your changes
  };

  const suspend = async (id) => {
    const yes = await showConfirm({
      title: "Suspend this client?",
      message: "They will immediately lose access.",
      type: "danger",
      confirmLabel: "Suspend",
    });
    if (!yes) return;
    await run(
      supabase.from("licences").update({ status: "suspended" }).eq("id", id),
      "Client suspended.",
    );
  };

  const activate = async (id) => {
    await run(
      supabase.from("licences").update({ status: "active" }).eq("id", id),
      "Client activated.",
    );
  };

  const del = async (id) => {
    const yes = await showConfirm({
      title: "Delete this licence?",
      message: "This cannot be undone.",
      type: "danger",
      confirmLabel: "Delete",
    });
    if (!yes) return;
    await run(
      supabase.from("licences").delete().eq("id", id),
      "Licence deleted.",
    );
  };

  // Stats
  const active = licences.filter((l) => l.status === "active").length;
  const suspended = licences.filter((l) => l.status === "suspended").length;
  const expiringSoon = licences.filter((l) => {
    if (!l.expires_at || l.status !== "active") return false;
    const days = (new Date(l.expires_at) - new Date()) / 1000 / 60 / 60 / 24;
    return days > 0 && days < 30;
  }).length;

  // ── Not the platform owner ────────────────────────────────────
  if (!isPlatformAdmin) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="card p-6 max-w-sm text-center space-y-2">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Not available
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Licence management is only available to the platform owner.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Licence Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage all client subscriptions
            </p>
          </div>
          <button className="btn-primary" onClick={openAdd}>
            + Add client
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Total clients",
              value: licences.length,
              color: "text-gray-900 dark:text-gray-100",
            },
            {
              label: "Active",
              value: active,
              color: "text-green-700 dark:text-green-400",
            },
            {
              label: "Suspended",
              value: suspended,
              color: "text-red-600 dark:text-red-400",
            },
            {
              label: "Expiring soon",
              value: expiringSoon,
              color: "text-amber-600 dark:text-amber-400",
            },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {s.label}
              </p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Licences table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              Loading…
            </div>
          ) : licences.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              No licences yet. Add your first client.
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="thead-row">
                  <th className="th">Client</th>
                  <th className="th">Licence key</th>
                  <th className="th">Plan</th>
                  <th className="th">Status</th>
                  <th className="th">Expires</th>
                  <th className="th">Domain</th>
                  <th className="th">Contact</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {licences.map((l) => {
                  const daysLeft = l.expires_at
                    ? Math.ceil(
                        (new Date(l.expires_at) - new Date()) /
                          1000 /
                          60 /
                          60 /
                          24,
                      )
                    : null;
                  const expiringSoon =
                    daysLeft !== null && daysLeft > 0 && daysLeft < 30;
                  return (
                    <tr key={l.id} className="tr">
                      <td className="td">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {l.client_name}
                        </p>
                        {l.notes && (
                          <p className="muted truncate max-w-[160px]">
                            {l.notes}
                          </p>
                        )}
                      </td>
                      <td className="td">
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-mono">
                          {l.licence_key}
                        </code>
                      </td>
                      <td className="td">
                        <span className={PLAN_STYLE[l.plan] || "chip-gray"}>
                          {l.plan}
                        </span>
                      </td>
                      <td className="td">
                        <span className={STATUS_STYLE[l.status] || "chip-gray"}>
                          {l.status}
                        </span>
                      </td>
                      <td className="td">
                        {l.expires_at ? (
                          <div>
                            <p
                              className={`text-sm ${expiringSoon ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-gray-600 dark:text-gray-400"}`}
                            >
                              {new Date(l.expires_at).toLocaleDateString(
                                "en-GB",
                              )}
                            </p>
                            {daysLeft !== null && daysLeft > 0 && (
                              <p className="muted">{daysLeft}d left</p>
                            )}
                            {daysLeft !== null && daysLeft <= 0 && (
                              <p className="text-xs text-red-500">Expired</p>
                            )}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="td text-xs text-gray-500 dark:text-gray-400">
                        {l.domain || "—"}
                      </td>
                      <td className="td text-xs text-gray-500 dark:text-gray-400">
                        {l.contact_email || "—"}
                      </td>
                      <td className="td">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => openEdit(l)}
                          >
                            Edit
                          </button>
                          {l.status === "active" ? (
                            <button
                              className="btn-ghost text-xs text-red-500 dark:text-red-400"
                              onClick={() => suspend(l.id)}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              className="btn-ghost text-xs text-green-600 dark:text-green-400"
                              onClick={() => activate(l.id)}
                            >
                              Activate
                            </button>
                          )}
                          {l.plan !== "owner" && (
                            <button
                              className="btn-ghost text-xs text-red-500 dark:text-red-400"
                              onClick={() => del(l.id)}
                            >
                              Del
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {editing ? "Edit client" : "Add new client"}
              </h2>
              <button
                onClick={close}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="label">Client / company name *</label>
                <input
                  className="input"
                  value={form.client_name}
                  onChange={f("client_name")}
                  placeholder="ABC Transport Ltd"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="label">Licence key *</label>
                  <button
                    type="button"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        licence_key: generateKey(p.client_name || "CLIENT"),
                      }))
                    }
                  >
                    Generate
                  </button>
                </div>
                <input
                  className="input font-mono"
                  value={form.licence_key}
                  onChange={f("licence_key")}
                  placeholder="AUTO-GENERATED"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Plan</label>
                  <select
                    className="input"
                    value={form.plan}
                    onChange={f("plan")}
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={form.status}
                    onChange={f("status")}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="label">Expires on</label>
                  <input
                    className="input"
                    type="date"
                    value={form.expires_at}
                    onChange={f("expires_at")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="label">Domain</label>
                  <input
                    className="input"
                    value={form.domain}
                    onChange={f("domain")}
                    placeholder="app.theirdomain.co.uk"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="label">Contact email</label>
                <input
                  className="input"
                  type="email"
                  value={form.contact_email}
                  onChange={f("contact_email")}
                  placeholder="owner@theirdomain.co.uk"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.notes}
                  onChange={f("notes")}
                  placeholder="Payment notes, setup details…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-5">
              <button className="btn-secondary" onClick={close}>
                Cancel
              </button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save client"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
