import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import EmptyState from "../components/EmptyState";
import { uid, fmtD } from "../lib/utils";

const STATUS_STYLE = {
  pending:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  approved:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  rejected:
    "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400",
};

export default function Applications() {
  const { applications, setApplications, staff, setStaff } = useApp();

  const [filter, setFilter] = useState("pending");
  const [viewing, setViewing] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(null);
  const [approveForm, setApproveForm] = useState({
    type: "driver",
    phone: "",
    email: "",
    dateOfBirth: "",
    nationality: "",
    address: "",
    notes: "",
  });
  const [adminNotes, setAdminNotes] = useState("");

  const filtered = useMemo(
    () =>
      [...applications]
        .filter((a) => filter === "all" || a.status === filter)
        .sort((a, b) => b.createdAt - a.createdAt),
    [applications, filter],
  );

  const counts = useMemo(
    () => ({
      pending: applications.filter((a) => a.status === "pending").length,
      approved: applications.filter((a) => a.status === "approved").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
    }),
    [applications],
  );

  const updateStatus = (app, status, notes = "") => {
    setApplications(
      applications.map((a) =>
        a.id === app.id
          ? { ...a, status, adminNotes: notes || a.adminNotes }
          : a,
      ),
    );
  };

  const openApprove = (app) => {
    setApproveForm({
      type: app.positionType === "pa" ? "pa" : "driver",
      phone: app.phone || "",
      email: app.email || "",
      dateOfBirth: app.dbsDob || "",
      nationality: app.nationality || "",
      address: app.currentAddress || "",
      notes: "",
    });
    setShowApproveModal(app);
  };

  const confirmApprove = () => {
    const app = showApproveModal;
    // Create staff record
    const newStaff = {
      id: uid(),
      name: app.fullName,
      shortName: app.fullName.split(" ")[0],
      type: approveForm.type,
      status: "active",
      phone: approveForm.phone,
      email: approveForm.email,
      dateOfBirth: approveForm.dateOfBirth || "",
      nationality: approveForm.nationality || "",
      address: approveForm.address || "",
      notes: approveForm.notes || `Created from application ${app.id}`,
      createdAt: Date.now(),
    };
    setStaff([...staff, newStaff]);
    updateStatus(app, "approved", adminNotes);
    setShowApproveModal(null);
    setViewing(null);
    alert(
      `✓ ${app.fullName} added to staff as ${approveForm.type.replace("_", "/")} and application marked approved.`,
    );
  };

  const reject = (app) => {
    const notes = prompt(
      `Reason for rejecting ${app.fullName}'s application? (optional)`,
    );
    if (notes === null) return; // cancelled
    updateStatus(app, "rejected", notes);
    setViewing(null);
  };

  const printApplication = (app) => {
    const fmtD2 = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    const row = (label, value, mono = false) =>
      value !== undefined && value !== null && value !== ""
        ? `<div class="row"><span class="label">${label}</span><span class="${mono ? "mono" : "val"}">${value}</span></div>`
        : "";
    const section = (title, content) =>
      `<div class="section"><div class="sec-hdr">${title}</div>${content}</div>`;

    const refs = (app.applicantRefs || [])
      .map((ref, i) =>
        section(
          `Reference ${i + 1}`,
          row("Name", ref.name) +
            row("Phone", ref.phone) +
            row("Relationship", ref.relationship) +
            row("Address", ref.address) +
            (ref.email ? row("Email", ref.email) : ""),
        ),
      )
      .join("");

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>Application — ${app.fullName}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:10pt;color:#000;padding:18mm}
        .bar{background:#1d4ed8;color:#fff;padding:8px 18px;display:flex;align-items:center;gap:12px;margin:-18mm -18mm 18px -18mm}
        .bar button{background:#fff;color:#1d4ed8;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-weight:bold}
        h1{font-size:16pt;text-align:center}
        .sub{text-align:center;color:#555;font-size:9.5pt;margin:4px 0 16px}
        .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#f5f5f5;padding:10px;border-radius:6px;margin-bottom:16px}
        .mi p:first-child{font-size:8pt;color:#666;text-transform:uppercase}
        .mi p:last-child{font-weight:bold}
        .section{margin-bottom:14px;break-inside:avoid}
        .sec-hdr{font-weight:bold;font-size:9pt;text-transform:uppercase;color:#555;padding:5px 0;border-bottom:1px solid #ccc;margin-bottom:6px}
        .row{display:flex;justify-content:space-between;align-items:flex-start;padding:3px 0;border-bottom:1px solid #f0f0f0;gap:12px}
        .label{font-size:8.5pt;color:#666;flex-shrink:0}
        .val{font-size:9pt;font-weight:500;text-align:right}
        .mono{font-family:monospace;font-size:9pt;text-align:right}
        .chip{display:inline-block;padding:2px 8px;border-radius:10px;font-size:8.5pt;font-weight:bold;text-transform:capitalize}
        .chip-pending{background:#fef3c7;color:#92400e}
        .chip-approved{background:#d1fae5;color:#065f46}
        .chip-rejected{background:#fee2e2;color:#991b1b}
        .green{color:#16a34a}
        .amber{color:#d97706}
        .red{color:#dc2626}
        @media print{.bar{display:none!important}}
      </style></head><body>
      <div class="bar">
        <span>Application — ${app.fullName}</span>
        <button onclick="window.print()">Save as PDF</button>
      </div>
      <h1>Staff Application</h1>
      <p class="sub">${app.fullName} — Applied ${new Date(app.createdAt).toLocaleDateString("en-GB")}</p>
      <div class="meta">
        <div class="mi"><p>Status</p><p><span class="chip chip-${app.status}">${app.status}</span></p></div>
        <div class="mi"><p>Position</p><p style="text-transform:capitalize">${app.positionType}</p></div>
        <div class="mi"><p>Applied</p><p>${new Date(app.createdAt).toLocaleDateString("en-GB")}</p></div>
      </div>
      ${section(
        "Personal Information",
        row("Full Name", app.fullName) +
          row("Email", app.email) +
          row("Phone", app.phone) +
          row("NI Number", app.niNumber, true) +
          row("Nationality", app.nationality) +
          row("Current Address", app.currentAddress) +
          (app.previousAddress
            ? row("Previous Address", app.previousAddress)
            : ""),
      )}
      ${section(
        "Work Eligibility",
        row("UK Driving Licence", app.hasUkDrivingLicence ? "✓ Yes" : "No") +
          row("Work Permit Required", app.requiresWorkPermit ? "⚠ Yes" : "No") +
          (app.requiresWorkPermit
            ? row("Work Permit Number", app.workPermitNumber, true)
            : ""),
      )}
      ${section(
        "Convictions",
        row("Has Convictions", app.hasConvictions ? "⚠ Yes" : "No") +
          (app.hasConvictions ? row("Details", app.convictionDetails) : ""),
      )}
      ${section(
        "DBS",
        row(
          "DBS Update Service",
          app.dbsRegistered ? "✓ Registered" : "Not registered",
        ) +
          (app.dbsRegistered
            ? row("Name on Certificate", app.dbsName) +
              row("Date of Birth", fmtD2(app.dbsDob)) +
              row("Certificate Number", app.dbsCertNumber, true) +
              (app.dbsUpdateId
                ? row("Update Service ID", app.dbsUpdateId, true)
                : "")
            : ""),
      )}
      ${refs}
      ${section(
        "Declaration",
        row("Agreed", app.declarationAgreed ? "Yes" : "No") +
          row("Signed by", app.declarationName) +
          row("Date", fmtD2(app.declarationDate)),
      )}
      ${app.adminNotes ? section("Admin Notes", `<p style="font-size:9pt;color:#555;font-style:italic">${app.adminNotes}</p>`) : ""}
    </body></html>`;

    const win = window.open("", "_blank", "width=900,height=800");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else alert("Pop-up blocked — please allow pop-ups for this site.");
  };

  const af = (k) => (e) =>
    setApproveForm((p) => ({ ...p, [k]: e.target.value }));

  const del = (app) => {
    if (
      !confirm(
        `Permanently delete ${app.fullName}'s application? This cannot be undone.`,
      )
    )
      return;
    setApplications(applications.filter((a) => a.id !== app.id));
    if (viewing?.id === app.id) setViewing(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Staff Applications"
        subtitle="Review and process incoming applications"
        actions={
          <div className="flex gap-2">
            {["pending", "approved", "rejected", "all"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filter === s ? "bg-blue-600 text-white" : "btn-secondary"}`}
              >
                {s}{" "}
                {s !== "all" && counts[s] > 0 && (
                  <span className="ml-1 bg-white/20 px-1.5 rounded-full text-xs">
                    {counts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon="📋"
              title={
                filter === "pending"
                  ? "No pending applications"
                  : `No ${filter} applications`
              }
              description={
                filter === "pending"
                  ? "New applications from your public form will appear here."
                  : ""
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((app) => (
                <div
                  key={app.id}
                  onClick={() => setViewing(app)}
                  className={`card p-4 cursor-pointer hover:shadow-md transition-shadow ${viewing?.id === app.id ? "ring-2 ring-blue-500" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                        {app.fullName?.[0] || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {app.fullName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {app.email} · {app.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString("en-GB")}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[app.status]}`}
                      >
                        {app.status}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                        {app.positionType}
                      </span>
                    </div>
                  </div>

                  {/* Quick flags */}
                  <div className="flex gap-2 mt-2 ml-12 flex-wrap">
                    {app.hasUkDrivingLicence && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✓ UK Driving Licence
                      </span>
                    )}
                    {app.requiresWorkPermit && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ Work permit required
                      </span>
                    )}
                    {app.hasConvictions && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        ⚠ Has convictions
                      </span>
                    )}
                    {app.dbsRegistered && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        ✓ DBS registered
                      </span>
                    )}
                  </div>

                  <div
                    className="flex gap-2 mt-3 ml-12"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {app.status === "pending" && (
                      <>
                        <button
                          className="btn-primary text-xs py-1.5 px-3"
                          onClick={() => openApprove(app)}
                        >
                          ✓ Approve & create staff
                        </button>
                        <button
                          className="btn-ghost text-xs py-1.5 px-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => reject(app)}
                        >
                          ✕ Reject
                        </button>
                      </>
                    )}
                    {(app.status === "rejected" ||
                      app.status === "approved") && (
                      <button
                        className="btn-ghost text-xs py-1.5 px-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => del(app)}
                      >
                        🗑 Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {viewing && (
          <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {viewing.fullName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => printApplication(viewing)}
                  className="btn-ghost text-xs"
                  title="Save as PDF"
                >
                  ↓ PDF
                </button>
                <button
                  onClick={() => setViewing(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 space-y-5 text-sm">
              {/* Status + actions */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[viewing.status]}`}
                >
                  {viewing.status}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                  {viewing.positionType}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {viewing.status === "pending" && (
                  <>
                    <button
                      className="btn-primary text-xs flex-1"
                      onClick={() => openApprove(viewing)}
                    >
                      ✓ Approve & create staff
                    </button>
                    <button
                      className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => reject(viewing)}
                    >
                      ✕ Reject
                    </button>
                  </>
                )}
                {(viewing.status === "rejected" ||
                  viewing.status === "approved") && (
                  <button
                    className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                    onClick={() => del(viewing)}
                  >
                    🗑 Delete application
                  </button>
                )}
              </div>

              {/* Personal */}
              <DetailSection title="Personal Information">
                <DetailRow label="Full Name" value={viewing.fullName} />
                <DetailRow label="Email" value={viewing.email} />
                <DetailRow label="Phone" value={viewing.phone} />
                <DetailRow label="NI Number" value={viewing.niNumber} mono />
                <DetailRow label="Nationality" value={viewing.nationality} />
                <DetailRow
                  label="Current Address"
                  value={viewing.currentAddress}
                />
                {viewing.previousAddress && (
                  <DetailRow
                    label="Previous Address"
                    value={viewing.previousAddress}
                  />
                )}
                <DetailRow
                  label="Applied"
                  value={new Date(viewing.createdAt).toLocaleDateString(
                    "en-GB",
                    {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                />
              </DetailSection>

              {/* Work eligibility */}
              <DetailSection title="Work Eligibility">
                <DetailRow
                  label="UK Driving Licence"
                  value={viewing.hasUkDrivingLicence ? "Yes" : "No"}
                  highlight={viewing.hasUkDrivingLicence}
                />
                <DetailRow
                  label="Work Permit Required"
                  value={viewing.requiresWorkPermit ? "Yes" : "No"}
                  warn={viewing.requiresWorkPermit}
                />
                {viewing.requiresWorkPermit && (
                  <DetailRow
                    label="Work Permit Number"
                    value={viewing.workPermitNumber}
                    mono
                  />
                )}
              </DetailSection>

              {/* Convictions */}
              <DetailSection title="Convictions">
                <DetailRow
                  label="Has Convictions"
                  value={viewing.hasConvictions ? "Yes" : "No"}
                  warn={viewing.hasConvictions}
                />
                {viewing.hasConvictions && (
                  <DetailRow
                    label="Details"
                    value={viewing.convictionDetails}
                  />
                )}
              </DetailSection>

              {/* DBS */}
              <DetailSection title="DBS">
                <DetailRow
                  label="DBS Update Service"
                  value={
                    viewing.dbsRegistered ? "Registered" : "Not registered"
                  }
                  highlight={viewing.dbsRegistered}
                />
                {viewing.dbsRegistered && (
                  <>
                    <DetailRow
                      label="Name on Certificate"
                      value={viewing.dbsName}
                    />
                    <DetailRow
                      label="Date of Birth"
                      value={fmtD(viewing.dbsDob)}
                    />
                    <DetailRow
                      label="Certificate Number"
                      value={viewing.dbsCertNumber}
                      mono
                    />
                    {viewing.dbsUpdateId && (
                      <DetailRow
                        label="Update Service ID"
                        value={viewing.dbsUpdateId}
                        mono
                      />
                    )}
                  </>
                )}
              </DetailSection>

              {/* References */}
              {viewing.applicantRefs?.map((ref, i) => (
                <DetailSection key={i} title={`Reference ${i + 1}`}>
                  <DetailRow label="Name" value={ref.name} />
                  <DetailRow label="Phone" value={ref.phone} />
                  <DetailRow label="Relationship" value={ref.relationship} />
                  <DetailRow label="Address" value={ref.address} />
                  {ref.email && <DetailRow label="Email" value={ref.email} />}
                </DetailSection>
              ))}

              {/* Admin notes */}
              {viewing.adminNotes && (
                <DetailSection title="Admin Notes">
                  <p className="text-gray-600 dark:text-gray-400 text-xs italic">
                    {viewing.adminNotes}
                  </p>
                </DetailSection>
              )}

              {/* Declaration */}
              <DetailSection title="Declaration">
                <DetailRow
                  label="Agreed"
                  value={viewing.declarationAgreed ? "Yes" : "No"}
                />
                <DetailRow label="Signed by" value={viewing.declarationName} />
                <DetailRow label="Date" value={fmtD(viewing.declarationDate)} />
              </DetailSection>
            </div>
          </div>
        )}
      </div>

      {/* ── Approve modal ── */}
      {showApproveModal && (
        <Modal
          title={`Approve & Create Staff — ${showApproveModal.fullName}`}
          onClose={() => setShowApproveModal(null)}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
              ℹ This will create a new staff record from the application. Review
              the details below before confirming.
            </div>

            <FormField label="Staff type">
              <select
                className="input"
                value={approveForm.type}
                onChange={af("type")}
              >
                <option value="driver">Driver</option>
                <option value="pa">PA</option>
                <option value="driver_pa">Driver & PA</option>
              </select>
            </FormField>

            <FormGrid cols={2}>
              <FormField label="Phone">
                <input
                  className="input"
                  value={approveForm.phone}
                  onChange={af("phone")}
                />
              </FormField>
              <FormField label="Email">
                <input
                  className="input"
                  value={approveForm.email}
                  onChange={af("email")}
                />
              </FormField>
            </FormGrid>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
              <p className="label">
                Details pre-filled from application — edit if needed
              </p>
              <FormGrid cols={2}>
                <FormField label="Date of birth">
                  <input
                    className="input"
                    type="date"
                    value={approveForm.dateOfBirth}
                    onChange={af("dateOfBirth")}
                  />
                </FormField>
                <FormField label="Nationality">
                  <input
                    className="input"
                    value={approveForm.nationality}
                    onChange={af("nationality")}
                  />
                </FormField>
              </FormGrid>
              <FormField label="Address">
                <input
                  className="input"
                  value={approveForm.address}
                  onChange={af("address")}
                />
              </FormField>
            </div>

            <FormField label="Admin notes (optional)">
              <input
                className="input"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Internal notes about this applicant…"
              />
            </FormField>
          </div>

          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowApproveModal(null)}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={confirmApprove}>
              ✓ Create staff member
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

// ── Detail panel helpers ───────────────────────────────────────────────────────
function DetailSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono, highlight, warn }) {
  if (!value && value !== false) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
        {label}
      </span>
      <span
        className={`text-xs text-right ${mono ? "font-mono" : "font-medium"} ${highlight ? "text-green-600 dark:text-green-400" : warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </span>
    </div>
  );
}
