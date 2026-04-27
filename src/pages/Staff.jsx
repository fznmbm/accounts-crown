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
  type: "driver",
  phone: "",
  email: "",
  bankName: "",
  accountNo: "",
  sortCode: "",
  notes: "",
};

export default function Staff() {
  const { staff, setStaff, payments, allocations } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
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
                  {s.accountNo && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      🏦{" "}
                      <span className="font-mono">
                        {s.sortCode} · {s.accountNo}
                      </span>
                      {s.bankName && (
                        <span className="text-gray-400 dark:text-gray-500">
                          {" "}
                          ({s.bankName})
                        </span>
                      )}
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
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pt-2 border-t border-gray-100 dark:border-gray-700">
              Bank details
            </p>
            <FormGrid cols={3}>
              <FormField label="Bank name">
                <input
                  className="input"
                  value={form.bankName}
                  onChange={f("bankName")}
                  placeholder="Barclays"
                />
              </FormField>
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
                  placeholder="12345678"
                />
              </FormField>
            </FormGrid>
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
