import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, ModalFooter } from "../components/Modal";
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

const STATUS_STYLE = {
  submitted:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  approved:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  rejected:
    "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400",
  recalled:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InvoiceSubmissions() {
  const { submissions, setSubmissions, payments, setPayments, staff } =
    useApp();

  const [monthF, setMonthF] = useState(() => {
    const s = localStorage.getItem("sub_month");
    return s !== null ? parseInt(s) : currentMonth();
  });
  const [yearF, setYearF] = useState(() => {
    const s = localStorage.getItem("sub_year");
    return s !== null ? parseInt(s) : currentYear();
  });
  const [statusF, setStatusF] = useState("all");
  const [viewing, setViewing] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(null);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveRef, setApproveRef] = useState("");

  const filtered = useMemo(
    () =>
      [...submissions]
        .filter((s) => {
          if (s.month !== monthF || s.year !== yearF) return false;
          if (statusF !== "all" && s.status !== statusF) return false;
          return true;
        })
        .sort((a, b) => b.submittedAt - a.submittedAt),
    [submissions, monthF, yearF, statusF],
  );

  const counts = useMemo(
    () => ({
      submitted: submissions.filter(
        (s) =>
          s.month === monthF && s.year === yearF && s.status === "submitted",
      ).length,
      approved: submissions.filter(
        (s) =>
          s.month === monthF && s.year === yearF && s.status === "approved",
      ).length,
      rejected: submissions.filter(
        (s) =>
          s.month === monthF && s.year === yearF && s.status === "rejected",
      ).length,
    }),
    [submissions, monthF, yearF],
  );

  const openApprove = (sub) => {
    setApproveAmount(sub.invoiceAmount?.toString() || "");
    setApproveRef(
      `INV-${sub.staffName?.split(" ")[0].toUpperCase()}-${MONTHS_SHORT[sub.month]}-${sub.year}`,
    );
    setShowApproveModal(sub);
  };

  const confirmApprove = async () => {
    const sub = showApproveModal;
    const amount = parseFloat(approveAmount) || 0;
    const staffMember = staff.find((s) => s.id === sub.staffId);

    // Create payment record
    const payment = {
      id: uid(),
      staffId: sub.staffId,
      amount,
      date: new Date().toISOString().split("T")[0],
      type: "bank_transfer",
      month: sub.month,
      year: sub.year,
      reference: approveRef,
      notes: `Approved from portal submission — ${MONTHS[sub.month]} ${sub.year}`,
      allocationIds: [],
      periodMonth: sub.month,
      periodYear: sub.year,
      isExternal: !staffMember,
      externalName: !staffMember ? sub.staffName : "",
      createdAt: Date.now(),
    };
    await setPayments([...payments, payment]);

    // Update submission status
    await setSubmissions(
      submissions.map((s) =>
        s.id === sub.id
          ? {
              ...s,
              status: "approved",
              approvedAt: Date.now(),
              paymentId: payment.id,
            }
          : s,
      ),
    );

    setShowApproveModal(null);
    if (viewing?.id === sub.id) setViewing({ ...sub, status: "approved" });
    alert(
      `✓ Approved. Payment record of ${fmt(amount)} created for ${sub.staffName}.`,
    );
  };

  const recall = (sub) => {
    const hasPayment =
      sub.paymentId && payments.find((p) => p.id === sub.paymentId);
    const msg = hasPayment
      ? `Recall ${sub.staffName}'s submission?\n\n⚠ This will also DELETE the associated payment record of ${fmt(sub.invoiceAmount)}. The driver can resubmit and a new payment will be created on re-approval.`
      : `Recall ${sub.staffName}'s submission? They will be able to edit and resubmit.`;
    if (!confirm(msg)) return;
    setSubmissions(
      submissions.map((s) =>
        s.id === sub.id ? { ...s, status: "recalled", paymentId: null } : s,
      ),
    );
    if (hasPayment) setPayments(payments.filter((p) => p.id !== sub.paymentId));
    if (viewing?.id === sub.id)
      setViewing({ ...sub, status: "recalled", paymentId: null });
  };

  const reject = (sub) => {
    if (
      !confirm(
        `Reject ${sub.staffName}'s submission for ${MONTHS[sub.month]} ${sub.year}?`,
      )
    )
      return;
    setSubmissions(
      submissions.map((s) =>
        s.id === sub.id ? { ...s, status: "rejected" } : s,
      ),
    );
    if (viewing?.id === sub.id) setViewing({ ...sub, status: "rejected" });
  };

  const totalSubmitted = useMemo(
    () => filtered.reduce((s, sub) => s + (sub.invoiceAmount || 0), 0),
    [filtered],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Invoice Submissions"
        subtitle="Review driver invoice submissions from the staff portal"
        actions={
          <div className="flex gap-2 flex-wrap">
            <select
              className="input w-36"
              value={monthF}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMonthF(v);
                localStorage.setItem("sub_month", v);
              }}
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
              onChange={(e) => {
                const v = Number(e.target.value);
                setYearF(v);
                localStorage.setItem("sub_year", v);
              }}
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {["all", "submitted", "approved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusF(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${statusF === s ? "bg-blue-600 text-white" : "btn-secondary"}`}
              >
                {s}{" "}
                {s !== "all" && counts[s] > 0 && (
                  <span className="ml-1 text-xs opacity-75">({counts[s]})</span>
                )}
              </button>
            ))}
          </div>
        }
      />

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total claimed:
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {fmt(totalSubmitted)}
            </span>
          </div>
          {counts.submitted > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠ {counts.submitted} awaiting review
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No submissions"
              description={`No invoice submissions for ${MONTHS[monthF]} ${yearF}${statusF !== "all" ? ` with status "${statusF}"` : ""}.`}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((sub) => {
                const routeCount = sub.routeEntries?.length || 0;
                const coverCount = sub.coverEntries?.length || 0;
                const isSelected = viewing?.id === sub.id;
                return (
                  <div
                    key={sub.id}
                    onClick={() => setViewing(sub)}
                    className={`card p-4 cursor-pointer hover:shadow-md transition-all ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                          {sub.staffName?.[0] || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {sub.staffName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {routeCount} route{routeCount !== 1 ? "s" : ""}
                            {coverCount > 0
                              ? ` · ${coverCount} cover entr${coverCount !== 1 ? "ies" : "y"}`
                              : ""}
                            {" · "} Submitted{" "}
                            {sub.submittedAt
                              ? new Date(sub.submittedAt).toLocaleDateString(
                                  "en-GB",
                                )
                              : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {fmt(sub.invoiceAmount)}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[sub.status]}`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    </div>

                    {/* Route summary chips */}
                    {sub.routeEntries?.length > 0 && (
                      <div className="flex gap-2 mt-2 ml-12 flex-wrap">
                        {sub.routeEntries.map((r, i) => (
                          <span
                            key={i}
                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                          >
                            {r.routeName} — {fmt(r.total)}
                          </span>
                        ))}
                        {coverCount > 0 && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                            + {coverCount} cover entr
                            {coverCount !== 1 ? "ies" : "y"}{" "}
                            {fmt(
                              sub.coverEntries.reduce(
                                (s, c) => s + (c.amount || 0),
                                0,
                              ),
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {(sub.status === "submitted" ||
                      sub.status === "approved") && (
                      <div
                        className="flex gap-2 mt-3 ml-12"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {sub.status === "submitted" && (
                          <button
                            className="btn-primary text-xs py-1.5 px-3"
                            onClick={() => openApprove(sub)}
                          >
                            ✓ Approve
                          </button>
                        )}
                        {sub.status === "submitted" && (
                          <button
                            className="btn-ghost text-xs py-1.5 px-3 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => reject(sub)}
                          >
                            ✕ Reject
                          </button>
                        )}
                        <button
                          className="btn-ghost text-xs py-1.5 px-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                          onClick={() => recall(sub)}
                        >
                          ↩ Recall
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {viewing && (
          <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {viewing.staffName}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {MONTHS[viewing.month]} {viewing.year}
                </p>
              </div>
              <button
                onClick={() => setViewing(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Status + actions */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[viewing.status]}`}
                >
                  {viewing.status}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Claimed:{" "}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {fmt(viewing.invoiceAmount)}
                  </span>
                </span>
              </div>

              {(viewing.status === "submitted" ||
                viewing.status === "approved") && (
                <div className="flex gap-2 flex-wrap">
                  {viewing.status === "submitted" && (
                    <button
                      className="btn-primary text-xs flex-1"
                      onClick={() => openApprove(viewing)}
                    >
                      ✓ Approve
                    </button>
                  )}
                  {viewing.status === "submitted" && (
                    <button
                      className="btn-ghost text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => reject(viewing)}
                    >
                      ✕ Reject
                    </button>
                  )}
                  <button
                    className="btn-ghost text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    onClick={() => recall(viewing)}
                  >
                    ↩ Recall
                  </button>
                </div>
              )}

              {/* Period */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  Period
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {fmtDate(viewing.periodFrom)} – {fmtDate(viewing.periodTo)}
                </p>
              </div>

              {/* Routes breakdown */}
              {viewing.routeEntries?.map((r, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    Route {i + 1}: {r.routeName}
                    <span className="ml-2 text-green-600 dark:text-green-400 normal-case font-bold">
                      {fmt(r.total)}
                    </span>
                  </p>
                  <div className="space-y-1">
                    {r.days
                      ?.sort((a, b) => a.date.localeCompare(b.date))
                      .map((d) => (
                        <div
                          key={d.date}
                          className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                        >
                          <span>
                            {new Date(d.date).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="font-mono">{fmt(d.amount)}</span>
                        </div>
                      ))}
                    {r.weekendDays
                      ?.filter((d) => d.date)
                      .map((d, j) => (
                        <div
                          key={j}
                          className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                        >
                          <span>
                            {new Date(d.date).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            <span className="text-amber-500">(wknd)</span>
                          </span>
                          <span className="font-mono">{fmt(d.amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}

              {/* Cover entries */}
              {viewing.coverEntries?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    Cover / Extra work
                  </p>
                  <div className="space-y-2">
                    {viewing.coverEntries.map((c, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs text-gray-600 dark:text-gray-400 gap-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-700 dark:text-gray-300 truncate">
                            {c.description}
                          </p>
                          <p className="text-gray-400 dark:text-gray-500">
                            {fmtDate(c.date)}
                          </p>
                        </div>
                        <span className="font-mono font-semibold flex-shrink-0">
                          {fmt(c.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Total claimed
                </span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {fmt(viewing.invoiceAmount)}
                </span>
              </div>

              {/* Declaration */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                  Declaration
                </p>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <p>
                    Signed:{" "}
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {viewing.signatureName}
                    </span>
                  </p>
                  <p>
                    Date:{" "}
                    <span className="text-gray-900 dark:text-gray-100">
                      {fmtDate(viewing.signatureDate)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Approved info */}
              {viewing.status === "approved" && viewing.approvedAt && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                    Approval
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Approved:{" "}
                    {new Date(viewing.approvedAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Approve modal ── */}
      {showApproveModal && (
        <Modal
          title={`Approve Submission — ${showApproveModal.staffName}`}
          onClose={() => setShowApproveModal(null)}
          size="sm"
        >
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>
                Staff:{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {showApproveModal.staffName}
                </span>
              </p>
              <p>
                Period:{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {MONTHS[showApproveModal.month]} {showApproveModal.year}
                </span>
              </p>
              <p>
                Claimed:{" "}
                <span className="font-medium text-green-600 dark:text-green-400">
                  {fmt(showApproveModal.invoiceAmount)}
                </span>
              </p>
            </div>

            <FormField
              label="Payment amount (£)"
              hint="Adjust if different from claimed amount"
            >
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
              />
            </FormField>

            <FormField label="Payment reference">
              <input
                className="input font-mono"
                value={approveRef}
                onChange={(e) => setApproveRef(e.target.value)}
              />
            </FormField>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
              ℹ This will create a payment record of{" "}
              {fmt(parseFloat(approveAmount) || 0)} in Staff Payments for{" "}
              {showApproveModal.staffName}.
            </div>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowApproveModal(null)}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={confirmApprove}>
              ✓ Approve & create payment
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
