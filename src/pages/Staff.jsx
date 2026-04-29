import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import { uid, fmt } from "../lib/utils";

const TYPES = [
  { value: "driver", label: "Driver" },
  { value: "pa", label: "Passenger Assistant (PA)" },
  { value: "driver_pa", label: "Driver / PA" },
];
const EMPTY = {
  name: "",
  shortName: "",
  type: "driver",
  status: "active",
  phone: "",
  email: "",
  dateOfBirth: "",
  nationality: "",
  address: "",
  notes: "",
};

export default function Staff() {
  const {
    staff,
    setStaff,
    payments,
    allocations,
    portalTokens,
    setPortalTokens,
  } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const getToken = (staffId) =>
    portalTokens.find((t) => t.staffId === staffId && t.active);

  const generateToken = async (s) => {
    const existing = getToken(s.id);
    if (existing) return existing;
    const newToken = {
      id: uid(),
      staffId: s.id,
      staffName: s.name,
      token: uid() + uid(),
      active: true,
      createdAt: Date.now(),
    };
    await setPortalTokens([...portalTokens, newToken]);
    return newToken;
  };

  const copyPortalLink = async (s) => {
    const token = await generateToken(s);
    const link = `${window.location.origin}/staff/${token.token}`;
    await navigator.clipboard.writeText(link);
    alert(
      `✓ Portal link copied!\n\n${link}\n\nSend this to ${s.name} — they can use it every month.`,
    );
  };

  const revokeToken = (staffId) => {
    if (
      !confirm(
        "Revoke this driver's portal link? They will no longer be able to submit invoices until a new link is generated.",
      )
    )
      return;
    setPortalTokens(
      portalTokens.map((t) =>
        t.staffId === staffId ? { ...t, active: false } : t,
      ),
    );
  };
  const open = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowModal(true);
  };
  const edit = (s) => {
    setForm({ ...EMPTY, ...s });
    setEditing(s);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.name) return;
    const record = {
      id: editing?.id || uid(),
      ...form,
      createdAt: editing?.createdAt || Date.now(),
    };
    setStaff(
      editing
        ? staff.map((s) => (s.id === editing.id ? record : s))
        : [...staff, record],
    );
    close();
  };

  const del = (id) => {
    const s = staff.find((x) => x.id === id);
    const payCount = payments.filter((p) => p.staffId === id).length;
    const allocCount = allocations.filter(
      (a) =>
        a.regularStaffId === id ||
        a.coverEntries?.some((c) => c.staffId === id) ||
        a.tempStaffId === id,
    ).length;
    let msg = `Remove ${s?.name}?`;
    if (payCount > 0 || allocCount > 0) {
      msg = `Remove ${s?.name}?\n\n⚠ Warning:\n`;
      if (allocCount > 0)
        msg += `• ${allocCount} allocation(s) reference this staff member\n`;
      if (payCount > 0)
        msg += `• ${payCount} payment(s) will become unlinked\n`;
      msg += "\nTheir history will remain but show as unknown staff.";
    }
    if (confirm(msg)) setStaff(staff.filter((x) => x.id !== id));
  };
  const totalPaid = (id) =>
    payments.filter((p) => p.staffId === id).reduce((s, p) => s + p.amount, 0);

  const filtered = staff.filter((s) => {
    if (typeF !== "all" && s.type !== typeF) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} member${staff.length !== 1 ? "s" : ""}`}
        actions={
          <button className="btn-primary" onClick={open}>
            + Add staff member
          </button>
        }
      />
      <div className="toolbar">
        <input
          className="input w-52"
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={typeF}
          onChange={(e) => setTypeF(e.target.value)}
        >
          <option value="all">All roles</option>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="page-body !space-y-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon="👤"
            title="No staff yet"
            description="Add your drivers and passenger assistants to start tracking payments."
            action={
              <button className="btn-primary" onClick={open}>
                Add first staff member
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 avatar text-base">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {s.name}
                      </p>
                      <Badge type={s.type} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => edit(s)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => del(s.id)}
                    >
                      Del
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 mb-4">
                  {s.shortName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🏷 {s.shortName}
                    </p>
                  )}
                  {s.phone && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      📞 {s.phone}
                    </p>
                  )}
                  {s.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ✉ {s.email}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      📍 {s.address}
                    </p>
                  )}
                  {s.dateOfBirth && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🎂 {new Date(s.dateOfBirth).toLocaleDateString("en-GB")}
                    </p>
                  )}
                  {s.nationality && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🌍 {s.nationality}
                    </p>
                  )}
                  {s.status && s.status !== "active" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium capitalize">
                      ● {s.status}
                    </p>
                  )}
                  {s.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                      {s.notes}
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    All-time paid
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(totalPaid(s.id))}
                  </span>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                  {(() => {
                    const token = getToken(s.id);
                    return token ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Portal active
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            onClick={() => copyPortalLink(s)}
                          >
                            Copy link
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">
                            ·
                          </span>
                          <button
                            className="text-xs text-red-500 dark:text-red-400 hover:underline"
                            onClick={() => revokeToken(s.id)}
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline text-left"
                        onClick={() => copyPortalLink(s)}
                      >
                        🔗 Generate &amp; copy portal link
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editing ? "Edit staff member" : "Add staff member"}
          onClose={close}
          size="lg"
        >
          <div className="space-y-4">
            <FormGrid cols={2}>
              <FormField label="Full name *">
                <input
                  className="input"
                  value={form.name}
                  onChange={f("name")}
                  placeholder="John Smith"
                />
              </FormField>
              <FormField
                label="Short name"
                hint="Used in attendance grid e.g. John"
              >
                <input
                  className="input"
                  value={form.shortName}
                  onChange={f("shortName")}
                  placeholder="John"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Role">
                <select
                  className="input"
                  value={form.type}
                  onChange={f("type")}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className="input"
                  value={form.status}
                  onChange={f("status")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Phone">
                <input
                  className="input"
                  value={form.phone}
                  onChange={f("phone")}
                  placeholder="07xxx xxxxxx"
                />
              </FormField>
              <FormField label="Email">
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={f("email")}
                  placeholder="john@example.com"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Date of birth">
                <input
                  className="input"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={f("dateOfBirth")}
                />
              </FormField>
              <FormField label="Nationality">
                <input
                  className="input"
                  value={form.nationality}
                  onChange={f("nationality")}
                  placeholder="British"
                />
              </FormField>
            </FormGrid>
            <FormField label="Address">
              <input
                className="input"
                value={form.address}
                onChange={f("address")}
                placeholder="1 High Street, Crawley, RH10 1AA"
              />
            </FormField>
            <FormField label="Notes">
              <textarea
                className="input"
                rows={2}
                value={form.notes}
                onChange={f("notes")}
                placeholder="Routes, cover arrangements…"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
