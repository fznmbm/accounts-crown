import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CONFIG } from "../config";

const uid = () => `${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const currentMonth = () => new Date().getMonth();
const currentYear = () => new Date().getFullYear();

// Get Mon-Fri dates for a month
function getMonthDays(month, year) {
  const days = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        week: Math.ceil(
          (d.getDate() + new Date(year, month, 1).getDay() - 1) / 7,
        ),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function fmt(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n || 0);
}

// ── Input styles ──────────────────────────────────────────────────────────────
const inp =
  "w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const inpSm =
  "px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

// ── Section header ────────────────────────────────────────────────────────────
function SectionTitle({ step, title, subtitle }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {step}
        </span>
        <h2 className="text-base font-bold text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-gray-400 ml-10">{subtitle}</p>}
    </div>
  );
}

export default function StaffPortal() {
  const { token } = useParams();

  // ── Token + staff lookup ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState(null);

  // Route entries: [{ id, routeName, dayEntries: [{ date, amount }], weekendEntries: [{ date, amount }] }]
  const [routeEntries, setRouteEntries] = useState([
    { id: uid(), routeName: "", dayEntries: {}, weekendEntries: [] },
  ]);

  // Cover entries: [{ id, date, description, amount }]
  const [coverEntries, setCoverEntries] = useState([]);

  // Declaration
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [signatureDate, setSignatureDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // Review screen
  const [showReview, setShowReview] = useState(false);

  // ── Load token ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadToken() {
      const { data, error } = await supabase
        .from("staff_portal_tokens")
        .select("*")
        .eq("token", token)
        .eq("active", true)
        .maybeSingle();
      if (error || !data) {
        setError(
          "This link is invalid or has been deactivated. Please contact your manager.",
        );
      } else {
        setTokenData(data);
      }
      setLoading(false);
    }
    loadToken();
  }, [token]);

  // Check if already submitted for selected month/year
  useEffect(() => {
    if (!tokenData) return;
    async function checkSubmission() {
      const { data } = await supabase
        .from("staff_invoice_submissions")
        .select("id, status")
        .eq("token_id", tokenData.id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();
      setExistingSubmission(data || null);
      setAlreadySubmitted(!!data && data.status !== "recalled");
    }
    checkSubmission();
  }, [tokenData, month, year]);

  // ── Month days ────────────────────────────────────────────────────────────
  const monthDays = getMonthDays(month, year);
  const weeks = [...new Set(monthDays.map((d) => d.week))];

  // ── Route entry helpers ───────────────────────────────────────────────────
  const addRoute = () =>
    setRouteEntries((p) => [
      ...p,
      { id: uid(), routeName: "", dayEntries: {}, weekendEntries: [] },
    ]);
  const removeRoute = (id) =>
    setRouteEntries((p) => p.filter((r) => r.id !== id));
  const updateRouteName = (id, name) =>
    setRouteEntries((p) =>
      p.map((r) => (r.id === id ? { ...r, routeName: name } : r)),
    );

  const updateDayEntry = (routeId, date, amount) => {
    setRouteEntries((p) =>
      p.map((r) => {
        if (r.id !== routeId) return r;
        const dayEntries = { ...r.dayEntries };
        if (amount === "" || amount === "0") {
          delete dayEntries[date];
        } else {
          dayEntries[date] = amount;
        }
        return { ...r, dayEntries };
      }),
    );
  };

  const addWeekendDay = (routeId) => {
    setRouteEntries((p) =>
      p.map((r) =>
        r.id === routeId
          ? {
              ...r,
              weekendEntries: [
                ...r.weekendEntries,
                { id: uid(), date: "", amount: "" },
              ],
            }
          : r,
      ),
    );
  };

  const updateWeekendEntry = (routeId, entryId, field, value) => {
    setRouteEntries((p) =>
      p.map((r) => {
        if (r.id !== routeId) return r;
        return {
          ...r,
          weekendEntries: r.weekendEntries.map((e) =>
            e.id === entryId ? { ...e, [field]: value } : e,
          ),
        };
      }),
    );
  };

  const removeWeekendEntry = (routeId, entryId) => {
    setRouteEntries((p) =>
      p.map((r) =>
        r.id === routeId
          ? {
              ...r,
              weekendEntries: r.weekendEntries.filter((e) => e.id !== entryId),
            }
          : r,
      ),
    );
  };

  // ── Cover entry helpers ───────────────────────────────────────────────────
  const addCover = () =>
    setCoverEntries((p) => [
      ...p,
      { id: uid(), date: "", description: "", amount: "" },
    ]);
  const removeCover = (id) =>
    setCoverEntries((p) => p.filter((c) => c.id !== id));
  const updateCover = (id, field, value) =>
    setCoverEntries((p) =>
      p.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );

  // ── Totals ────────────────────────────────────────────────────────────────
  const routeTotal = (r) => {
    const weekday = Object.values(r.dayEntries).reduce(
      (s, v) => s + (parseFloat(v) || 0),
      0,
    );
    const weekend = r.weekendEntries.reduce(
      (s, e) => s + (parseFloat(e.amount) || 0),
      0,
    );
    return weekday + weekend;
  };
  const allRoutesTotal = routeEntries.reduce((s, r) => s + routeTotal(r), 0);
  const coverTotal = coverEntries.reduce(
    (s, c) => s + (parseFloat(c.amount) || 0),
    0,
  );
  const grandTotal = allRoutesTotal + coverTotal;

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    if (routeEntries.some((r) => !r.routeName?.trim()))
      return "Please enter a route name/number for each route.";
    if (
      routeEntries.every(
        (r) =>
          Object.keys(r.dayEntries).length === 0 &&
          r.weekendEntries.length === 0,
      )
    )
      return "Please enter at least one day worked.";
    if (
      coverEntries.some((c) => !c.date || !c.description?.trim() || !c.amount)
    )
      return "Please complete all cover/extra entries.";
    if (!periodFrom || !periodTo)
      return "Please enter the period of work dates.";
    if (!declarationAgreed) return "Please agree to the declaration.";
    if (!signatureName?.trim()) return "Please enter your name as signature.";
    return null;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = async () => {
    setSubmitting(true);
    try {
      const routePayload = routeEntries.map((r) => ({
        routeName: r.routeName,
        days: Object.entries(r.dayEntries).map(([date, amount]) => ({
          date,
          amount: parseFloat(amount) || 0,
        })),
        weekendDays: r.weekendEntries.map((e) => ({
          date: e.date,
          amount: parseFloat(e.amount) || 0,
        })),
        total: routeTotal(r),
      }));
      const coverPayload = coverEntries.map((c) => ({
        date: c.date,
        description: c.description,
        amount: parseFloat(c.amount) || 0,
      }));

      const record = {
        id: uid(),
        token_id: tokenData.id,
        user_id: CONFIG.ownerUserId,
        staff_id: tokenData.staff_id,
        staff_name: tokenData.staff_name,
        month,
        year,
        route_entries: routePayload,
        cover_entries: coverPayload,
        days_confirmed: routeEntries.reduce(
          (s, r) =>
            s +
            Object.keys(r.dayEntries).length +
            r.weekendEntries.filter((e) => e.date).length,
          0,
        ),
        invoice_number: null,
        invoice_amount: grandTotal,
        period_from: periodFrom,
        period_to: periodTo,
        signature_name: signatureName,
        signature_date: signatureDate,
        notes: null,
        status: "submitted",
        submitted_at: Date.now(),
        approved_at: null,
        payment_id: null,
        created_at: Date.now(),
      };

      const { error } =
        existingSubmission?.status === "recalled"
          ? await supabase
              .from("staff_invoice_submissions")
              .update({ ...record, id: undefined })
              .eq("id", existingSubmission.id)
          : await supabase.from("staff_invoice_submissions").insert(record);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      alert("Submission failed: " + (err.message || "Please try again."));
    }
    setSubmitting(false);
  };

  // ── Loading / error screens ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-white">Link Invalid</h1>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-white">Invoice Submitted</h1>
          <p className="text-gray-400">
            Thank you {tokenData.staff_name}. Your invoice for {MONTHS[month]}{" "}
            {year} has been submitted to {CONFIG.companyName}. You will be
            contacted once it has been reviewed.
          </p>
          <p className="text-sm text-gray-500">You can close this window.</p>
        </div>
      </div>
    );
  }

  // ── Review screen ─────────────────────────────────────────────────────────
  if (showReview) {
    return (
      <div className="min-h-screen bg-gray-950 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">
              Review Your Invoice
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {MONTHS[month]} {year} — {tokenData.staff_name}
            </p>
          </div>

          {/* Routes summary */}
          {routeEntries.map((r, i) => (
            <div
              key={r.id}
              className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Route {i + 1}: {r.routeName}
                </p>
                <p className="text-sm font-bold text-green-400">
                  {fmt(routeTotal(r))}
                </p>
              </div>
              <div className="p-4 space-y-1">
                {Object.entries(r.dayEntries)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, amount]) => (
                    <div
                      key={date}
                      className="flex justify-between text-xs text-gray-300"
                    >
                      <span>
                        {new Date(date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="font-mono">
                        {fmt(parseFloat(amount))}
                      </span>
                    </div>
                  ))}
                {r.weekendEntries
                  .filter((e) => e.date && e.amount)
                  .map((e) => (
                    <div
                      key={e.id}
                      className="flex justify-between text-xs text-gray-300"
                    >
                      <span>
                        {new Date(e.date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        (weekend)
                      </span>
                      <span className="font-mono">
                        {fmt(parseFloat(e.amount))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* Cover summary */}
          {coverEntries.length > 0 && (
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Cover / Extra work
                </p>
                <p className="text-sm font-bold text-green-400">
                  {fmt(coverTotal)}
                </p>
              </div>
              <div className="p-4 space-y-1">
                {coverEntries.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between text-xs text-gray-300 gap-4"
                  >
                    <span>
                      {c.description} —{" "}
                      {new Date(c.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="font-mono flex-shrink-0">
                      {fmt(parseFloat(c.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 flex items-center justify-between">
            <p className="text-white font-semibold">Total Invoice Amount</p>
            <p className="text-xl font-bold text-green-400">
              {fmt(grandTotal)}
            </p>
          </div>

          {/* Declaration summary */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-2 text-xs text-gray-300">
            <p>
              <span className="text-gray-500">Period:</span>{" "}
              {new Date(periodFrom).toLocaleDateString("en-GB")} –{" "}
              {new Date(periodTo).toLocaleDateString("en-GB")}
            </p>
            <p>
              <span className="text-gray-500">Signed by:</span> {signatureName}
            </p>
            <p>
              <span className="text-gray-500">Date:</span>{" "}
              {new Date(signatureDate).toLocaleDateString("en-GB")}
            </p>
          </div>

          <div className="flex gap-3 pb-10">
            <button
              onClick={() => setShowReview(false)}
              className="flex-1 py-3 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              ← Back & Edit
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {submitting ? "Submitting…" : "✓ Confirm & Submit"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">
            {CONFIG.companyName}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Invoice Submission Portal
          </p>
        </div>

        {/* Month selector */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Submitting invoice for
          </p>
          <div className="flex gap-3">
            <select
              className={inp}
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setAlreadySubmitted(false);
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select
              className={inp}
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setAlreadySubmitted(false);
              }}
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {alreadySubmitted && (
            <div className="mt-3 p-3 bg-amber-900/30 border border-amber-700 rounded-lg text-sm text-amber-400">
              ⚠ You have already submitted an invoice for {MONTHS[month]} {year}
              . Please contact your manager if you need to make changes.
            </div>
          )}
          {existingSubmission?.status === "recalled" && (
            <div className="mt-3 p-3 bg-purple-900/30 border border-purple-700 rounded-lg text-sm text-purple-400">
              ↩ Your {MONTHS[month]} {year} submission has been recalled by your
              manager. Please review and resubmit below.
            </div>
          )}
        </div>

        {!alreadySubmitted && (
          <>
            {/* Step 1 — Personal info */}
            <div>
              <SectionTitle
                step="1"
                title="Your Details"
                subtitle="Please confirm your information is correct"
              />
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-sm font-medium text-white">
                      {tokenData.staff_name}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  If any details are incorrect, please contact your manager
                  before submitting.
                </p>
              </div>
            </div>

            {/* Step 2 — Regular routes */}
            <div>
              <SectionTitle
                step="2"
                title="Regular Routes"
                subtitle="Enter each route you worked on. Click a day to enter your fare for that day — leave blank if you didn't work."
              />

              <div className="space-y-6">
                {routeEntries.map((route, routeIdx) => (
                  <div
                    key={route.id}
                    className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
                  >
                    {/* Route header */}
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          Route {routeIdx + 1}
                        </span>
                        <input
                          className={inpSm}
                          value={route.routeName}
                          onChange={(e) =>
                            updateRouteName(route.id, e.target.value)
                          }
                          placeholder="Route name or number e.g. Philpots Manor / 50540"
                        />
                      </div>
                      {routeEntries.length > 1 && (
                        <button
                          onClick={() => removeRoute(route.id)}
                          className="text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Day grid by week */}
                    <div className="p-4 space-y-4">
                      {weeks.map((week) => {
                        const weekDays = monthDays.filter(
                          (d) => d.week === week,
                        );
                        return (
                          <div key={week}>
                            <p className="text-xs text-gray-500 mb-2">
                              Week {week}
                            </p>
                            <div className="grid grid-cols-5 gap-1">
                              {weekDays.map((day) => {
                                const val = route.dayEntries[day.date] || "";
                                return (
                                  <div key={day.date} className="space-y-1">
                                    <p className="text-[10px] text-gray-400 text-center">
                                      {day.label
                                        .split(" ")
                                        .slice(0, 2)
                                        .join(" ")}
                                    </p>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                        £
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className={`${inpSm} pl-5 text-center ${val ? "border-green-600 bg-green-900/10" : ""}`}
                                        value={val}
                                        onChange={(e) =>
                                          updateDayEntry(
                                            route.id,
                                            day.date,
                                            e.target.value,
                                          )
                                        }
                                        placeholder="0"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Weekend entries */}
                      {route.weekendEntries.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500">
                            Weekend / extra days
                          </p>
                          {route.weekendEntries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="date"
                                className={`${inpSm} flex-1`}
                                value={entry.date}
                                onChange={(e) =>
                                  updateWeekendEntry(
                                    route.id,
                                    entry.id,
                                    "date",
                                    e.target.value,
                                  )
                                }
                              />
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                  £
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className={`${inpSm} pl-5`}
                                  value={entry.amount}
                                  onChange={(e) =>
                                    updateWeekendEntry(
                                      route.id,
                                      entry.id,
                                      "amount",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Amount"
                                />
                              </div>
                              <button
                                onClick={() =>
                                  removeWeekendEntry(route.id, entry.id)
                                }
                                className="text-xs text-red-400 hover:text-red-300 flex-shrink-0"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Route footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                        <button
                          onClick={() => addWeekendDay(route.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          + Add weekend / extra day
                        </button>
                        <p className="text-sm font-semibold text-green-400">
                          Route total: {fmt(routeTotal(route))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addRoute}
                  className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  + Add another route
                </button>
              </div>
            </div>

            {/* Step 3 — Cover / extra work */}
            <div>
              <SectionTitle
                step="3"
                title="Cover & Extra Work"
                subtitle="Add any covering or extra jobs you did this month. Leave blank if none."
              />
              <div className="space-y-3">
                {coverEntries.map((c) => (
                  <div
                    key={c.id}
                    className="bg-gray-800/50 rounded-xl border border-gray-700 p-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Date</p>
                        <input
                          type="date"
                          className={inpSm}
                          value={c.date}
                          onChange={(e) =>
                            updateCover(c.id, "date", e.target.value)
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-400 mb-1">
                          Description
                        </p>
                        <input
                          className={inpSm}
                          value={c.description}
                          onChange={(e) =>
                            updateCover(c.id, "description", e.target.value)
                          }
                          placeholder="e.g. Covered Route 50625 AM, Philpots Manor"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-[140px]">
                        <p className="text-xs text-gray-400 mb-1">Amount</p>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                            £
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inpSm} pl-5`}
                            value={c.amount}
                            onChange={(e) =>
                              updateCover(c.id, "amount", e.target.value)
                            }
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => removeCover(c.id)}
                        className="text-xs text-red-400 hover:text-red-300 mt-4"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addCover}
                  className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl text-sm text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  + Add cover / extra work entry
                </button>
              </div>
            </div>

            {/* Step 4 — Totals summary */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Invoice summary
              </p>
              {routeEntries.map((r, i) => (
                <div
                  key={r.id}
                  className="flex justify-between text-sm text-gray-300"
                >
                  <span>
                    Route {i + 1}
                    {r.routeName ? ` — ${r.routeName}` : ""}
                  </span>
                  <span className="font-mono">{fmt(routeTotal(r))}</span>
                </div>
              ))}
              {coverEntries.length > 0 && (
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Cover / extra work</span>
                  <span className="font-mono">{fmt(coverTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-white border-t border-gray-600 pt-2 mt-2">
                <span>Total</span>
                <span className="text-green-400">{fmt(grandTotal)}</span>
              </div>
            </div>

            {/* Step 5 — Declaration */}
            <div>
              <SectionTitle step="4" title="Declaration" />
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-4">
                <div className="p-3 bg-gray-700/50 rounded-lg text-sm text-gray-300 leading-relaxed">
                  I confirm that the work I done for {CONFIG.companyName} is
                  self employment work/job and confirm that I am responsible to
                  pay my own tax and N.I contribution.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      Period of work From{" "}
                      <span className="text-red-400">*</span>
                    </p>
                    <input
                      type="date"
                      className={inp}
                      value={periodFrom}
                      onChange={(e) => setPeriodFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      To <span className="text-red-400">*</span>
                    </p>
                    <input
                      type="date"
                      className={inp}
                      value={periodTo}
                      onChange={(e) => setPeriodTo(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Total Pay (£)</p>
                  <div className="px-3 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-green-400 font-bold text-sm">
                    {fmt(grandTotal)}
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAgreed}
                    onChange={(e) => setDeclarationAgreed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-blue-500 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-300">
                    I agree to the above declaration
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      Print Name / Signature{" "}
                      <span className="text-red-400">*</span>
                    </p>
                    <input
                      className={inp}
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="Enter your name as signature"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      Date <span className="text-red-400">*</span>
                    </p>
                    <input
                      type="date"
                      className={inp}
                      value={signatureDate}
                      onChange={(e) => setSignatureDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Review button */}
            <div className="flex flex-wrap justify-between items-center gap-3 pb-10">
              <p className="text-sm text-gray-400">
                Total:{" "}
                <span className="text-green-400 font-bold">
                  {fmt(grandTotal)}
                </span>
              </p>
              <button
                onClick={() => {
                  const err = validate();
                  if (err) {
                    alert(err);
                    return;
                  }
                  setShowReview(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                Review Invoice →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
