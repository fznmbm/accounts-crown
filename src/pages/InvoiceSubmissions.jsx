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
import { getExpectedSubmissions } from "../lib/monthStatus";
import { toast } from "sonner";

const STATUS_STYLE = {
  submitted:
    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  approved:
    "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  rejected:
    "bg-red-100   dark:bg-red-900/30   text-red-700   dark:text-red-400",
  recalled:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  office_recorded:
    "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400",
};

const STATUS_LABEL = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  recalled: "Recalled",
  office_recorded: "Recorded by office",
};

const CATEGORY_LABEL = {
  regular: "Regular",
  cover: "Cover",
  external: "External",
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
  const {
    submissions,
    setSubmissions,
    payments,
    setPayments,
    staff,
    settings,
    allocations,
    portalTokens,
    setPortalTokens,
    auditLog,
    addAuditEntry,
  } = useApp();
  const [tab, setTab] = useState(
    () => localStorage.getItem("sub_tab") || "submissions",
  );
  const [officeForm, setOfficeForm] = useState(null);

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
      recalled: submissions.filter(
        (s) =>
          s.month === monthF && s.year === yearF && s.status === "recalled",
      ).length,
      office_recorded: submissions.filter(
        (s) =>
          s.month === monthF &&
          s.year === yearF &&
          s.status === "office_recorded",
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

  const printSubmission = (sub) => {
    const fmtA = (n) =>
      `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtD = (d) =>
      d
        ? new Date(d).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";

    const routeRows = (sub.routeEntries || [])
      .map((r, i) => {
        const workedMap = {};
        (r.days || []).forEach((d) => {
          workedMap[d.date] = d.amount;
        });
        const weekendMap = {};
        (r.weekendDays || [])
          .filter((d) => d.date)
          .forEach((d) => {
            weekendMap[d.date] = d.amount;
          });
        // Build full calendar month (Mon-Fri) for the submission's month/year —
        // NOT the period dates. Period is for the declaration record only and
        // must never hide entered figures.
        const rows = [];
        const cur = new Date(sub.year, sub.month, 1);
        while (cur.getMonth() === sub.month) {
          const dow = cur.getDay();
          if (dow >= 1 && dow <= 5) {
            rows.push(
              `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
            );
          }
          cur.setDate(cur.getDate() + 1);
        }
        let dayRows = rows
          .map((key) => {
            const amount = workedMap[key];
            const label = new Date(key.replace(/-/g, "/")).toLocaleDateString(
              "en-GB",
              { weekday: "short", day: "numeric", month: "short" },
            );
            return amount
              ? `<div class="row"><span>${label}</span><span>${fmtA(amount)}</span></div>`
              : `<div class="row" style="color:#ccc"><span>${label}</span><span>—</span></div>`;
          })
          .join("");
        const extraKeys = Object.keys(workedMap).filter(
          (k) => !rows.includes(k),
        );
        dayRows += extraKeys
          .map((key) => {
            const label = new Date(key.replace(/-/g, "/")).toLocaleDateString(
              "en-GB",
              { weekday: "short", day: "numeric", month: "short" },
            );
            return `<div class="row"><span>${label} (outside month)</span><span>${fmtA(workedMap[key])}</span></div>`;
          })
          .join("");
        const weekendRows = Object.entries(weekendMap)
          .map(
            ([key, amount]) =>
              `<div class="row"><span>${new Date(key.replace(/-/g, "/")).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} (wknd)</span><span>${fmtA(amount)}</span></div>`,
          )
          .join("");
        return `
      <div class="section">
        <div class="sec-hdr">Route ${i + 1}: ${r.routeName}<span class="green">${fmtA(r.total)}</span></div>
        ${dayRows}${weekendRows}
      </div>`;
      })
      .join("");

    const coverRows =
      (sub.coverEntries || []).length > 0
        ? `
      <div class="section">
        <div class="sec-hdr">Cover / Extra Work</div>
        ${(sub.coverEntries || [])
          .map(
            (c) => `
          <div class="row"><span>${c.description} — ${fmtD(c.date)}</span><span>${fmtA(c.amount)}</span></div>`,
          )
          .join("")}
      </div>`
        : "";

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <title>Submission — ${sub.staffName} — ${MONTHS[sub.month]} ${sub.year}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:10pt;color:#000;padding:18mm}
        .bar{background:#1d4ed8;color:#fff;padding:8px 18px;display:flex;align-items:center;gap:12px;margin:-18mm -18mm 18px -18mm}
        .bar button{background:#fff;color:#1d4ed8;border:none;padding:5px 14px;border-radius:4px;cursor:pointer;font-weight:bold}
        h1{font-size:16pt;text-align:center}
        .sub{text-align:center;color:#555;font-size:9.5pt;margin:4px 0 16px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f5f5f5;padding:10px;border-radius:6px;margin-bottom:16px}
        .mi p:first-child{font-size:8pt;color:#666;text-transform:uppercase}
        .mi p:last-child{font-weight:bold}
        .section{margin-bottom:14px}
        .sec-hdr{display:flex;justify-content:space-between;font-weight:bold;font-size:9pt;text-transform:uppercase;color:#555;padding:5px 0;border-bottom:1px solid #ccc;margin-bottom:5px}
        .row{display:flex;justify-content:space-between;padding:2.5px 0;font-size:9.5pt;border-bottom:1px solid #f0f0f0}
        .total{display:flex;justify-content:space-between;font-weight:bold;font-size:11pt;padding:10px 0;border-top:2px solid #000;margin-top:10px}
        .decl{margin-top:16px;background:#f5f5f5;padding:10px;border-radius:6px;font-size:9pt}
        .green{color:#16a34a}
        .chip{display:inline-block;padding:2px 8px;border-radius:10px;font-size:8.5pt;font-weight:bold;text-transform:capitalize}
        .chip-submitted{background:#fef3c7;color:#92400e}
        .chip-approved{background:#d1fae5;color:#065f46}
        .chip-rejected{background:#fee2e2;color:#991b1b}
        .chip-recalled{background:#ede9fe;color:#5b21b6}
        @media print{.bar{display:none!important}}
      </style></head><body>
      <div class="bar">
        <span>${sub.staffName} — ${MONTHS[sub.month]} ${sub.year} Invoice Submission</span>
        <button onclick="window.print()">Save as PDF</button>
      </div>
      <h1>Invoice Submission</h1>
      <p class="sub">${sub.staffName} — ${MONTHS[sub.month]} ${sub.year}</p>
      <div class="meta">
        <div class="mi"><p>Status</p><p><span class="chip chip-${sub.status}">${sub.status}</span></p></div>
        <div class="mi"><p>Total Claimed</p><p class="green">${fmtA(sub.invoiceAmount)}</p></div>
        <div class="mi"><p>Period</p><p>${fmtD(sub.periodFrom)} – ${fmtD(sub.periodTo)}</p></div>
        <div class="mi"><p>Submitted</p><p>${sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("en-GB") : "—"}</p></div>
      </div>
      ${routeRows}${coverRows}
      <div class="total"><span>Total Claimed</span><span class="green">${fmtA(sub.invoiceAmount)}</span></div>
  <div class="decl">
        <p style="font-weight:bold;margin-bottom:8px">Declaration</p>
        <p style="font-size:9pt;color:#333;font-style:italic;padding:8px 10px;background:#fff;border-left:3px solid #ccc;border-radius:0 4px 4px 0;margin-bottom:10px">I confirm that the work I have done for ${settings?.companyName || "the company"} is self employment work/job and confirm that I am responsible to pay my own tax and N.I contribution.</p>
        <p>Signed: <strong>${sub.signatureName || "—"}</strong></p>
        <p>Date: ${fmtD(sub.signatureDate)}</p>
        ${sub.status === "approved" && sub.approvedAt ? `<p style="margin-top:5px;color:#065f46">✓ Approved: ${new Date(sub.approvedAt).toLocaleDateString("en-GB")}</p>` : ""}
      </div>
    </body></html>`;

    const win = window.open("", "_blank", "width=900,height=800");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else alert("Pop-up blocked — please allow pop-ups for this site.");
  };

  const totalSubmitted = useMemo(
    () => filtered.reduce((s, sub) => s + (sub.invoiceAmount || 0), 0),
    [filtered],
  );

  // ── Not submitted: who we expect an invoice from this month ───────────────
  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );
  const expected = useMemo(
    () =>
      getExpectedSubmissions({
        month: monthF,
        year: yearF,
        allocations,
        staff,
        submissions,
        mustSubmitTypes: settings?.mustSubmitTypes,
      }),
    [monthF, yearF, allocations, staff, submissions, settings],
  );
  const toChase = expected.people.filter((p) => p.needsChasing);
  const toRecord = expected.people.filter((p) => p.canRecordByOffice);
  const received = expected.people.filter((p) => p.received);

  const reminderId = (p) => `${p.key}|${yearF}-${monthF}`;
  const lastReminded = (p) =>
    (auditLog || []).find(
      (a) => a.action === "reminder" && a.entityId === reminderId(p),
    )?.createdAt;

  // UK mobile → WhatsApp format (07… → 447…)
  const waNumber = (phone) => {
    let d = String(phone || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+")) d = d.slice(1);
    else if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith("0")) d = "44" + d.slice(1);
    return d.length >= 10 ? d : "";
  };

  const ensureToken = async (p) => {
    const existing = portalTokens.find(
      (t) => t.staffId === p.staffId && t.active,
    );
    if (existing) return existing;
    const t = {
      id: uid(),
      staffId: p.staffId,
      staffName: p.name,
      token: uid() + uid(),
      active: true,
      createdAt: Date.now(),
    };
    const ok = await setPortalTokens([...portalTokens, t]);
    return ok === false ? null : t;
  };
  const portalUrl = (t) => `${window.location.origin}/staff/${t.token}`;

  const copyLink = async (p) => {
    const t = await ensureToken(p);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(portalUrl(t));
      toast.success(`Portal link copied for ${p.name}.`);
    } catch {
      toast.error("Couldn't copy — your browser blocked the clipboard.");
    }
  };

  const sendReminder = async (p) => {
    // Open the tab now (before any await) so the browser doesn't block it
    const win = window.open("", "_blank");
    const t = await ensureToken(p);
    if (!t) {
      win?.close();
      return;
    }
    const first = (p.name || "").split(" ")[0];
    const text =
      `Hi ${first}, a reminder to send your invoice for ${MONTHS[monthF]} ${yearF}. ` +
      `You can submit it here: ${portalUrl(t)}\n\nThanks,\n${settings?.companyName || ""}`;
    const number = waNumber(staffById.get(p.staffId)?.phone || p.phone);
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    if (win) win.location.href = url;
    else window.open(url, "_blank");
    if (!number)
      toast.warning(
        `No mobile number saved for ${p.name} — pick them in WhatsApp, and add their number on the Staff page.`,
      );
    addAuditEntry(
      "reminder",
      "submission",
      reminderId(p),
      `${p.name} — ${MONTHS[monthF]} ${yearF}`,
      { via: "whatsapp" },
    );
  };

  const saveOfficeRecord = async () => {
    const { person: p, amount, note } = officeForm;
    const value = parseFloat(amount);
    if (!(value >= 0)) {
      toast.error("Enter the amount on their invoice.");
      return;
    }
    const record = {
      id: uid(),
      tokenId: null,
      staffId: p.staffId || null,
      staffName: p.name,
      month: monthF,
      year: yearF,
      routeEntries: [],
      coverEntries: [],
      daysConfirmed: null,
      invoiceNumber: null,
      invoiceAmount: Math.round(value * 100) / 100,
      notes: note.trim(),
      status: "office_recorded",
      submittedAt: Date.now(),
      approvedAt: null,
      paymentId: null,
      createdAt: Date.now(),
    };
    const ok = await setSubmissions([...submissions, record]);
    if (ok === false) return;
    setOfficeForm(null);
    toast.success(`${p.name}'s invoice recorded as received.`);
  };

  const undoOfficeRecord = async (sub) => {
    if (
      !confirm(
        `Undo the office record for ${sub.staffName} (${MONTHS[sub.month]} ${sub.year})? They'll show as not submitted again.`,
      )
    )
      return;
    const ok = await setSubmissions(submissions.filter((s) => s.id !== sub.id));
    if (ok === false) return;
    if (viewing?.id === sub.id) setViewing(null);
    toast.success("Office record removed.");
  };

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
            {tab === "submissions" &&
              [
                "all",
                "submitted",
                "approved",
                "office_recorded",
                "rejected",
                "recalled",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusF(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${statusF === s ? "bg-blue-600 text-white" : "btn-secondary"}`}
                >
                  {s === "office_recorded" ? "office" : s}{" "}
                  {s !== "all" && counts[s] > 0 && (
                    <span className="ml-1 text-xs opacity-75">
                      ({counts[s]})
                    </span>
                  )}
                </button>
              ))}
          </div>
        }
      />

      {/* Tabs */}
      <div className="px-4 sm:px-6 pt-3 border-b border-gray-200 dark:border-gray-700 flex gap-1 overflow-x-auto flex-shrink-0">
        {[
          { id: "submissions", label: "Submissions" },
          {
            id: "missing",
            label: `Not submitted${expected.summary.missing + expected.summary.toRecord > 0 ? ` (${expected.summary.missing + expected.summary.toRecord})` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              localStorage.setItem("sub_tab", t.id);
            }}
            className={`px-4 py-2.5 sm:py-2 whitespace-nowrap text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-700 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "submissions" && (
        <>
          {/* Summary strip */}
          {filtered.length > 0 && (
            <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-6 gap-y-1">
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
            <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
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
                                  ? new Date(
                                      sub.submittedAt,
                                    ).toLocaleDateString("en-GB")
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
                              {STATUS_LABEL[sub.status] || sub.status}
                            </span>
                          </div>
                        </div>

                        {/* Route summary chips */}
                        {sub.routeEntries?.length > 0 && (
                          <div className="flex gap-2 mt-2 ml-0 sm:ml-12 flex-wrap">
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

                        {sub.status === "office_recorded" && (
                          <div
                            className="flex flex-wrap items-center gap-3 mt-3 ml-0 sm:ml-12"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sub.notes && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                                {sub.notes}
                              </span>
                            )}
                            <button
                              className="btn-ghost text-xs py-1.5 px-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              onClick={() => undoOfficeRecord(sub)}
                            >
                              ↩ Undo
                            </button>
                          </div>
                        )}

                        {(sub.status === "submitted" ||
                          sub.status === "approved") && (
                          <div
                            className="flex flex-wrap gap-2 mt-3 ml-0 sm:ml-12"
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
              // Phones/tablets: full screen over the list. Desktop: side panel.
              <div className="fixed inset-0 z-40 lg:static lg:z-auto w-full lg:w-96 flex-shrink-0 lg:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto overscroll-contain">
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewing(null)}
                    className="lg:hidden btn-ghost -ml-2 text-sm"
                    aria-label="Back to list"
                  >
                    ← Back
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {viewing.staffName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {MONTHS[viewing.month]} {viewing.year}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printSubmission(viewing)}
                      className="btn-ghost text-xs"
                      title="Save as PDF"
                    >
                      ↓ PDF
                    </button>
                    <button
                      onClick={() => setViewing(null)}
                      className="hidden lg:inline text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-5">
                  {/* Status + actions */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[viewing.status]}`}
                    >
                      {STATUS_LABEL[viewing.status] || viewing.status}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Claimed:{" "}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(viewing.invoiceAmount)}
                      </span>
                    </span>
                  </div>

                  {viewing.status === "office_recorded" && (
                    <div className="space-y-2">
                      {viewing.notes && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                          {viewing.notes}
                        </p>
                      )}
                      <button
                        className="btn-ghost text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        onClick={() => undoOfficeRecord(viewing)}
                      >
                        ↩ Undo office record
                      </button>
                    </div>
                  )}

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
                      {fmtDate(viewing.periodFrom)} –{" "}
                      {fmtDate(viewing.periodTo)}
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
                        {(() => {
                          const workedMap = {};
                          (r.days || []).forEach((d) => {
                            workedMap[d.date] = d.amount;
                          });
                          const weekendMap = {};
                          (r.weekendDays || [])
                            .filter((d) => d.date)
                            .forEach((d) => {
                              weekendMap[d.date] = d.amount;
                            });
                          const rows = [];
                          const cur = new Date(viewing.year, viewing.month, 1);
                          while (cur.getMonth() === viewing.month) {
                            const dow = cur.getDay();
                            if (dow >= 1 && dow <= 5) {
                              rows.push(
                                `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
                              );
                            }
                            cur.setDate(cur.getDate() + 1);
                          }
                          const extraKeys = Object.keys(workedMap).filter(
                            (k) => !rows.includes(k),
                          );

                          // ── Anomaly detection ──────────────────────────────
                          const workedAmounts = Object.values(workedMap).map(
                            (a) => parseFloat(a) || 0,
                          );
                          const workedDayCount = workedAmounts.length;
                          // Find modal (most common) amount
                          const freq = {};
                          workedAmounts.forEach((a) => {
                            freq[a] = (freq[a] || 0) + 1;
                          });
                          const standardAmount =
                            workedDayCount > 0
                              ? parseFloat(
                                  Object.entries(freq).sort(
                                    (a, b) => b[1] - a[1],
                                  )[0][0],
                                )
                              : null;
                          const anomalies = Object.entries(workedMap)
                            .filter(
                              ([, amt]) =>
                                standardAmount !== null &&
                                Math.abs(parseFloat(amt) - standardAmount) >
                                  0.01,
                            )
                            .sort(([a], [b]) => a.localeCompare(b));

                          return (
                            <>
                              {rows.map((key) => {
                                const amount = workedMap[key];
                                const isAnomaly =
                                  amount &&
                                  standardAmount !== null &&
                                  Math.abs(
                                    parseFloat(amount) - standardAmount,
                                  ) > 0.01;
                                return (
                                  <div
                                    key={key}
                                    className={`flex justify-between text-xs ${
                                      isAnomaly
                                        ? "text-amber-600 dark:text-amber-400 font-semibold"
                                        : amount
                                          ? "text-gray-600 dark:text-gray-400"
                                          : "text-gray-300 dark:text-gray-600"
                                    }`}
                                  >
                                    <span>
                                      {new Date(
                                        key.replace(/-/g, "/"),
                                      ).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                      })}
                                      {isAnomaly && (
                                        <span className="ml-1">⚠</span>
                                      )}
                                    </span>
                                    <span className={amount ? "font-mono" : ""}>
                                      {amount ? fmt(amount) : "—"}
                                    </span>
                                  </div>
                                );
                              })}
                              {extraKeys.map((key) => (
                                <div
                                  key={`extra_${key}`}
                                  className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                                >
                                  <span>
                                    {new Date(
                                      key.replace(/-/g, "/"),
                                    ).toLocaleDateString("en-GB", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}{" "}
                                    <span className="text-amber-500">
                                      (outside month)
                                    </span>
                                  </span>
                                  <span className="font-mono">
                                    {fmt(workedMap[key])}
                                  </span>
                                </div>
                              ))}
                              {Object.entries(weekendMap).map(
                                ([key, amount]) => (
                                  <div
                                    key={`wknd_${key}`}
                                    className="flex justify-between text-xs text-gray-600 dark:text-gray-400"
                                  >
                                    <span>
                                      {new Date(
                                        key.replace(/-/g, "/"),
                                      ).toLocaleDateString("en-GB", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                      })}{" "}
                                      <span className="text-amber-500">
                                        (wknd)
                                      </span>
                                    </span>
                                    <span className="font-mono">
                                      {fmt(amount)}
                                    </span>
                                  </div>
                                ),
                              )}

                              {/* ── Day count + anomaly summary ── */}
                              <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                                <span>
                                  {workedDayCount} day
                                  {workedDayCount !== 1 ? "s" : ""} worked
                                  {standardAmount !== null && (
                                    <span className="ml-1">
                                      · usual {fmt(standardAmount)}/day
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono font-semibold text-gray-600 dark:text-gray-400">
                                  {fmt(r.total)}
                                </span>
                              </div>
                              {anomalies.length > 0 && (
                                <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg space-y-1">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                    ⚠ {anomalies.length} day
                                    {anomalies.length !== 1 ? "s" : ""} with
                                    different amount
                                  </p>
                                  {anomalies.map(([key, amt]) => (
                                    <div
                                      key={`anom_${key}`}
                                      className="flex justify-between text-xs text-amber-600 dark:text-amber-400"
                                    >
                                      <span>
                                        {new Date(
                                          key.replace(/-/g, "/"),
                                        ).toLocaleDateString("en-GB", {
                                          weekday: "short",
                                          day: "numeric",
                                          month: "short",
                                        })}
                                      </span>
                                      <span className="font-mono">
                                        {fmt(amt)}{" "}
                                        <span className="text-amber-400 dark:text-amber-500">
                                          (usual {fmt(standardAmount)})
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
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
                        {new Date(viewing.approvedAt).toLocaleDateString(
                          "en-GB",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Not submitted ── */}
      {tab === "missing" && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {expected.people.length === 0 ? (
            <EmptyState
              icon="📭"
              title="Nobody expected"
              description={`No allocations over £0 for ${MONTHS[monthF]} ${yearF}, so no invoices are expected.`}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                <span>
                  Expected: <b>{expected.summary.expected}</b>
                </span>
                <span>
                  Received:{" "}
                  <b className="text-green-700 dark:text-green-400">
                    {expected.summary.received}
                  </b>
                </span>
                <span>
                  To chase:{" "}
                  <b className="text-red-600 dark:text-red-400">
                    {expected.summary.missing}
                  </b>
                  {expected.summary.missing > 0 &&
                    ` (${fmt(expected.summary.missingAmount)})`}
                </span>
                <span>
                  Office to record:{" "}
                  <b className="text-amber-600 dark:text-amber-400">
                    {expected.summary.toRecord}
                  </b>
                </span>
              </div>

              {[
                {
                  kind: "chase",
                  title: "Must submit — not received",
                  hint: "Regular drivers and PAs. Send a reminder, or record an invoice that came by paper or email.",
                  list: toChase,
                },
                {
                  kind: "record",
                  title: "Cover / external — office records",
                  hint: "Not expected to use the portal. Record what they're owed once you have their details.",
                  list: toRecord,
                },
              ]
                .filter((g) => g.list.length > 0)
                .map((g) => (
                  <div key={g.kind}>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {g.title} ({g.list.length})
                    </p>
                    <p className="muted mb-2">{g.hint}</p>
                    <div className="space-y-2">
                      {g.list.map((p) => {
                        const reminded = lastReminded(p);
                        return (
                          <div key={p.key} className="card p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {p.name}{" "}
                                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                                    {CATEGORY_LABEL[p.category]}
                                    {p.category === "regular" && !p.mustSubmit
                                      ? " · not required to submit"
                                      : ""}
                                  </span>
                                </p>
                                <div className="flex gap-1.5 mt-1 flex-wrap">
                                  {p.lines.map((l, i) => (
                                    <span
                                      key={i}
                                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                                    >
                                      {l.routeLabel} · {l.role} · {l.days} day
                                      {l.days !== 1 ? "s" : ""}
                                    </span>
                                  ))}
                                </div>
                                <p className="muted mt-1">
                                  {p.status === "missing"
                                    ? "Nothing received"
                                    : `Their invoice was ${p.status}`}
                                  {reminded
                                    ? ` · Last reminded ${new Date(reminded).toLocaleDateString("en-GB")}`
                                    : ""}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                  {fmt(p.expectedAmount)}
                                </p>
                                <p className="muted">expected</p>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {p.staffId && staffById.has(p.staffId) && (
                                <>
                                  {g.kind === "chase" && (
                                    <button
                                      className="btn-primary text-xs py-1.5 px-3"
                                      onClick={() => sendReminder(p)}
                                    >
                                      💬 WhatsApp reminder
                                    </button>
                                  )}
                                  <button
                                    className="btn-secondary text-xs py-1.5 px-3"
                                    onClick={() => copyLink(p)}
                                  >
                                    🔗 Copy portal link
                                  </button>
                                </>
                              )}
                              <button
                                className="btn-secondary text-xs py-1.5 px-3"
                                onClick={() =>
                                  setOfficeForm({
                                    person: p,
                                    kind: g.kind,
                                    amount: p.expectedAmount.toFixed(2),
                                    note: "",
                                  })
                                }
                              >
                                {g.kind === "chase"
                                  ? "📨 Received another way"
                                  : "📝 Record by office"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {received.length > 0 && (
                <details className="card p-4">
                  <summary className="text-sm font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                    Received ({received.length})
                  </summary>
                  <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                    {received.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="text-gray-800 dark:text-gray-200">
                          {p.name}{" "}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {CATEGORY_LABEL[p.category]}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-semibold">
                            {fmt(p.submission?.invoiceAmount)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[p.status]}`}
                          >
                            {STATUS_LABEL[p.status] || p.status}
                          </span>
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => {
                              setTab("submissions");
                              localStorage.setItem("sub_tab", "submissions");
                              setStatusF("all");
                              setViewing(p.submission);
                            }}
                          >
                            View
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Record by office / received another way ── */}
      {officeForm && (
        <Modal
          title={
            officeForm.kind === "chase"
              ? `Invoice received another way — ${officeForm.person.name}`
              : `Record by office — ${officeForm.person.name}`
          }
          onClose={() => setOfficeForm(null)}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {MONTHS[monthF]} {yearF} · expected{" "}
              {fmt(officeForm.person.expectedAmount)}. This marks their invoice
              as received. It does not create a payment — pay them from Pay run
              as usual.
            </p>
            <FormField label="Amount on their invoice (£)">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={officeForm.amount}
                onChange={(e) =>
                  setOfficeForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Note">
              <textarea
                className="input"
                rows={3}
                placeholder={
                  officeForm.kind === "chase"
                    ? "e.g. Paper invoice handed in 3 Nov"
                    : "e.g. Days checked against attendance"
                }
                value={officeForm.note}
                onChange={(e) =>
                  setOfficeForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </FormField>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setOfficeForm(null)}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={saveOfficeRecord}>
              Save
            </button>
          </ModalFooter>
        </Modal>
      )}

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
