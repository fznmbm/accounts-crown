import { useState } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/PageHeader";
import Modal, { FormField, FormGrid, ModalFooter } from "../components/Modal";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import DropZone from "../components/DropZone";
import { parseInvoicePDF } from "../lib/pdfParser";
import {
  uid,
  fmt,
  MONTHS,
  MONTHS_SHORT,
  YEARS,
  currentMonth,
  currentYear,
} from "../lib/utils";
import { generateInvoicePDF } from "../lib/invoiceGenerator";

const STATUS_OPTS = ["unpaid", "partial", "paid"];

const EMPTY = {
  invoiceNumber: "",
  routeNumber: "",
  routeName: "",
  poNumber: "",
  invoiceDate: "",
  month: currentMonth(),
  year: currentYear(),
  daysWorked: "",
  unitPrice: "",
  netTotal: "",
  vat: "",
  total: "",
  status: "unpaid",
  paidAmount: "",
};

export default function Invoices() {
  const { invoices, setInvoices, routes, settings, attendance } = useApp();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [monthF, setMonthF] = useState("all");
  const [yearF, setYearF] = useState(() => {
    const s = localStorage.getItem("invoices_year");
    return s !== null ? s : String(currentYear());
  });
  const [showModal, setShowModal] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [showRevise, setShowRevise] = useState(false);
  const [revising, setRevising] = useState(null);
  const [reviseNote, setReviseNote] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState("");
  const [preview, setPreview] = useState(null);
  const [showGen, setShowGen] = useState(false);
  const [genMonth, setGenMonth] = useState(currentMonth());
  const [genYear, setGenYear] = useState(currentYear());
  const [genDate, setGenDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [genStartNum, setGenStartNum] = useState("");
  const [genDays, setGenDays] = useState({});
  const [genBandDays, setGenBandDays] = useState({});
  const [genNotes, setGenNotes] = useState({});

  const nextInvoiceNum = () => {
    const nums = invoices.map((x) => parseInt(x.invoiceNumber)).filter(Boolean);
    return nums.length ? String(Math.max(...nums) + 1) : "";
  };

  const getAttendanceDays = (routeId, month, year) =>
    attendance
      .filter(
        (a) => a.routeId === routeId && a.month === month && a.year === year,
      )
      .reduce((s, a) => s + (a.daysValue ?? 1), 0);

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  //const findRoute = (num) => routes.find((r) => r.number === num);
  const findRoute = (num) =>
    routes.find(
      (r) =>
        r.number === num ||
        r.number === "R" + num ||
        r.number.replace(/^R/i, "") === num.replace(/^R/i, ""),
    );

  const openAdd = () => {
    setForm(EMPTY);
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (inv) => {
    setForm({
      ...inv,
      daysWorked: inv.daysWorked || "",
      unitPrice: inv.unitPrice || "",
      paidAmount: inv.paidAmount || "",
    });
    setEditing(inv);
    setShowModal(true);
  };
  const close = () => {
    setShowModal(false);
    setEditing(null);
    setFormErrors({});
  };

  const openRevise = (inv) => {
    setRevising(inv);
    setReviseNote("");
    setShowRevise(true);
  };

  const saveRevision = () => {
    if (!revising) return;
    const newNumber = `${revising.invoiceNumber}-R1`;
    const existing = invoices.find((x) => x.invoiceNumber === newNumber);
    if (existing) {
      alert(`Revised invoice ${newNumber} already exists.`);
      return;
    }
    // Mark original as revised
    const updatedOriginal = {
      ...revising,
      isRevised: true,
      revisedBy: newNumber,
      revisionNote: reviseNote,
    };
    // Create revised copy
    const revised = {
      ...revising,
      id: uid(),
      invoiceNumber: newNumber,
      status: "unpaid",
      paidAmount: 0,
      isRevised: false,
      revisedBy: null,
      revisionNote: reviseNote,
      originalInvoiceId: revising.id,
      createdAt: Date.now(),
    };
    setInvoices(
      invoices
        .map((x) => (x.id === revising.id ? updatedOriginal : x))
        .concat(revised),
    );
    setShowRevise(false);
    setRevising(null);
    // Open edit modal on the new revised invoice so user can correct the days/amount
    openEdit(revised);
  };

  const saveManual = () => {
    const errs = {};
    if (!form.invoiceNumber?.trim()) errs.invoiceNumber = "Required";
    if (!form.routeNumber?.trim()) errs.routeNumber = "Required";
    if (!form.total || isNaN(form.total) || Number(form.total) <= 0)
      errs.total = "Enter a valid amount";
    if (!form.month && form.month !== 0) errs.month = "Required";
    if (!form.year) errs.year = "Required";
    if (
      form.status === "partial" &&
      (!form.paidAmount || Number(form.paidAmount) <= 0)
    )
      errs.paidAmount = "Enter amount received";
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    const record = {
      id: editing?.id || uid(),
      ...form,
      month: parseInt(form.month),
      year: parseInt(form.year),
      daysWorked: parseFloat(form.daysWorked) || 0,
      unitPrice: parseFloat(form.unitPrice) || 0,
      netTotal: parseFloat(form.netTotal) || 0,
      vat: parseFloat(form.vat) || 0,
      total: parseFloat(form.total) || 0,
      paidAmount:
        form.status === "paid"
          ? parseFloat(form.total)
          : form.status === "partial"
            ? parseFloat(form.paidAmount) || 0
            : 0,
      createdAt: editing?.createdAt || Date.now(),
    };
    setInvoices(
      editing
        ? invoices.map((x) => (x.id === editing.id ? record : x))
        : [...invoices, record],
      {
        action: editing ? "update" : "create",
        id: record.id,
        label: `Invoice #${record.invoiceNumber} — Route ${record.routeNumber}`,
        changes: editing
          ? {
              daysWorked: { from: editing.daysWorked, to: record.daysWorked },
              total: { from: editing.total, to: record.total },
              status: { from: editing.status, to: record.status },
            }
          : null,
      },
    );
    close();
  };

  const del = (id) => {
    if (confirm("Delete this invoice?")) {
      const inv = invoices.find((x) => x.id === id);
      setInvoices(
        invoices.filter((x) => x.id !== id),
        { action: "delete", id, label: `Invoice #${inv?.invoiceNumber}` },
      );
    }
  };

  const handleFiles = async (files) => {
    setParsing(true);
    setParseErr("");
    setPreview(null);
    try {
      const results = await Promise.allSettled(
        files.map((f) => parseInvoicePDF(f)),
      );
      const parsed = [];
      const errors = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled")
          parsed.push({ ...r.value, _id: uid(), _file: files[i].name });
        else
          errors.push(
            `${files[i].name}: ${r.reason?.message || "parse error"}`,
          );
      });
      if (errors.length) setParseErr(errors.join(" · "));
      if (parsed.length) setPreview(parsed);
    } catch (e) {
      setParseErr("Failed: " + e.message);
    }
    setParsing(false);
  };

  const updateRow = (id, key, val) =>
    setPreview((p) => p.map((r) => (r._id === id ? { ...r, [key]: val } : r)));

  const confirmImport = () => {
    const existing = new Set(invoices.map((x) => x.invoiceNumber));
    const duplicates = preview.filter((r) => existing.has(r.invoiceNumber));
    const fresh = preview.filter((r) => !existing.has(r.invoiceNumber));

    if (duplicates.length > 0) {
      const nums = duplicates.map((r) => `#${r.invoiceNumber}`).join(", ");
      const proceed = confirm(
        `⚠ ${duplicates.length} invoice${duplicates.length > 1 ? "s" : ""} already exist: ${nums}\n\nThese will be skipped. Import the ${fresh.length} new invoice${fresh.length !== 1 ? "s" : ""}?`,
      );
      if (!proceed) return;
    }

    if (fresh.length === 0) {
      alert("All invoices in this PDF already exist — nothing imported.");
      setPreview(null);
      return;
    }

    setInvoices([
      ...invoices,
      ...fresh.map((r) => ({
        id: uid(),
        invoiceNumber: r.invoiceNumber,
        poNumber: r.poNumber,
        invoiceDate: r.invoiceDate,
        month: Number(r.month),
        year: Number(r.year),
        routeNumber: r.routeNumber,
        routeName: r.routeName,
        daysWorked: Number(r.daysWorked) || 0,
        unitPrice: Number(r.unitPrice) || 0,
        netTotal: Number(r.netTotal) || 0,
        vat: Number(r.vat) || 0,
        total: Number(r.total) || 0,
        status: "unpaid",
        paidAmount: 0,
        fileName: r._file || r.fileName,
        createdAt: Date.now(),
      })),
    ]);
    setPreview(null);
    setParseErr("");
  };

  const filtered = invoices
    .filter((x) => {
      if (statusF !== "all" && x.status !== statusF) return false;
      if (monthF !== "all" && x.month !== parseInt(monthF)) return false;
      if (yearF !== "all" && x.year !== parseInt(yearF)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !x.invoiceNumber?.includes(search) &&
          !x.routeNumber?.includes(search) &&
          !x.routeName?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.invoiceNumber) - Number(a.invoiceNumber));

  const totalF = filtered.reduce((s, x) => s + (x.total || 0), 0);
  const paidF = filtered.reduce((s, x) => s + (x.paidAmount || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${invoices.filter((x) => x.status === "unpaid").length} unpaid`}
        actions={
          <div className="flex gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setGenStartNum(nextInvoiceNum());
                // Pre-fill days from attendance register
                const preFilled = {};
                routes
                  .filter((r) => r.active && !r.suspended)
                  .forEach((r) => {
                    const days = getAttendanceDays(
                      r.id,
                      currentMonth(),
                      currentYear(),
                    );
                    if (days > 0) preFilled[r.id] = String(days);
                  });
                setGenDays(preFilled);
                setGenBandDays({});
                setGenNotes({});
                setShowGen(true);
              }}
            >
              Generate invoices
            </button>
            <button className="btn-primary" onClick={openAdd}>
              + Add manually
            </button>
          </div>
        }
      />

      <div className="page-body">
        {/* Drop zone */}
        {!preview && (
          <>
            <DropZone
              onFiles={handleFiles}
              label={
                parsing
                  ? "Parsing PDFs…"
                  : "Drop invoice PDFs here to bulk import"
              }
              sublabel="Supports multiple files — drop all invoices for a month at once"
            />
            {parseErr && (
              <div className="alert-danger text-sm text-red-700 dark:text-red-400">
                {parseErr}
              </div>
            )}
          </>
        )}

        {/* Preview table */}
        {preview && (
          <div className="card overflow-hidden border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {preview.length} invoice{preview.length > 1 ? "s" : ""} parsed
                  — review before importing
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  You can edit any field before confirming.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-secondary text-xs"
                  onClick={() => setPreview(null)}
                >
                  Cancel
                </button>
                <button className="btn-primary text-xs" onClick={confirmImport}>
                  ✓ Import {preview.length} invoice
                  {preview.length > 1 ? "s" : ""}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Invoice #</th>
                    <th className="th">Route</th>
                    <th className="th">PO</th>
                    <th className="th">Period</th>
                    <th className="th-r">Days</th>
                    <th className="th-r">Unit price</th>
                    <th className="th-r">Net</th>
                    <th className="th-r">VAT</th>
                    <th className="th-r">Total</th>
                    <th className="th">Match</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {preview.map((r) => {
                    const match = findRoute(r.routeNumber);
                    return (
                      <tr
                        key={r._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <td className="td">
                          <input
                            className="input w-20 font-mono text-xs py-1"
                            value={r.invoiceNumber}
                            onChange={(e) =>
                              updateRow(r._id, "invoiceNumber", e.target.value)
                            }
                          />
                        </td>
                        <td className="td">
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                            {r.routeNumber}
                          </span>{" "}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {r.routeName}
                          </span>
                        </td>
                        <td className="td font-mono text-xs text-gray-400 dark:text-gray-500">
                          {r.poNumber}
                        </td>
                        <td className="td text-xs">
                          {MONTHS_SHORT[r.month]} {r.year}
                        </td>
                        <td className="td-r">
                          <input
                            className="input w-16 text-right text-xs py-1"
                            type="number"
                            value={r.daysWorked}
                            onChange={(e) =>
                              updateRow(r._id, "daysWorked", e.target.value)
                            }
                          />
                        </td>
                        <td className="td-r">
                          <input
                            className="input w-24 text-right text-xs py-1"
                            type="number"
                            step="0.01"
                            value={r.unitPrice}
                            onChange={(e) =>
                              updateRow(r._id, "unitPrice", e.target.value)
                            }
                          />
                        </td>
                        <td className="td-r font-medium">{fmt(r.netTotal)}</td>
                        <td className="td-r text-gray-400 dark:text-gray-500">
                          {fmt(r.vat)}
                        </td>
                        <td className="td-r font-semibold">{fmt(r.total)}</td>
                        <td className="td">
                          {match ? (
                            <span className="chip-green">✓ route found</span>
                          ) : (
                            <span className="chip-amber">new route</span>
                          )}
                        </td>
                        <td className="td">
                          <button
                            className="text-gray-400 hover:text-red-500 text-xs"
                            onClick={() =>
                              setPreview((p) =>
                                p.filter((x) => x._id !== r._id),
                              )
                            }
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="input w-52"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input w-32"
            value={statusF}
            onChange={(e) => setStatusF(e.target.value)}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="input w-36"
            value={monthF}
            onChange={(e) => setMonthF(e.target.value)}
          >
            <option value="all">All months</option>
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="input w-28"
            value={yearF}
            onChange={(e) => {
              setYearF(e.target.value);
              localStorage.setItem("invoices_year", e.target.value);
            }}
          >
            <option value="all">All years</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {filtered.length > 0 && (
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {filtered.length} ·{" "}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {fmt(totalF)}
              </span>{" "}
              ·{" "}
              <span className="text-green-700 dark:text-green-400 font-medium">
                {fmt(paidF)}
              </span>{" "}
              received
            </span>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No invoices found"
            description="Drop your invoice PDFs above to bulk import, or add one manually."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="thead-row">
                    <th className="th">Invoice #</th>
                    <th className="th">Route</th>
                    <th className="th">Period</th>
                    <th className="th-r">Days</th>
                    <th className="th-r">Net</th>
                    <th className="th-r">VAT</th>
                    <th className="th-r">Total</th>
                    <th className="th-r">Received</th>
                    <th className="th">Status</th>
                    <th className="th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="tr">
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                            #{inv.invoiceNumber}
                          </p>
                          {inv.isRevised && (
                            <span className="chip-red text-xs">superseded</span>
                          )}
                          {inv.originalInvoiceId && (
                            <span className="chip-blue text-xs">revised</span>
                          )}
                        </div>
                        {inv.poNumber && (
                          <p className="font-mono text-xs text-gray-400 dark:text-gray-500">
                            {inv.poNumber}
                          </p>
                        )}
                        {inv.revisionNote && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            {inv.revisionNote}
                          </p>
                        )}
                      </td>
                      <td className="td">
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          Route {inv.routeNumber}
                        </p>
                        <p className="muted">{inv.routeName}</p>
                        {inv.notes && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">
                            {inv.notes}
                          </p>
                        )}
                      </td>
                      <td className="td text-gray-600 dark:text-gray-400">
                        {MONTHS_SHORT[inv.month]} {inv.year}
                      </td>
                      <td className="td-r text-gray-500 dark:text-gray-400">
                        {inv.daysWorked || "—"}
                      </td>
                      <td className="td-r text-gray-600 dark:text-gray-400">
                        {fmt(inv.netTotal)}
                      </td>
                      <td className="td-r text-gray-400 dark:text-gray-500 text-xs">
                        {fmt(inv.vat)}
                      </td>
                      <td className="td-r font-semibold text-gray-900 dark:text-gray-100">
                        {fmt(inv.total)}
                      </td>
                      <td className="td-r font-medium text-green-700 dark:text-green-400">
                        {inv.paidAmount > 0 ? fmt(inv.paidAmount) : "—"}
                      </td>
                      <td className="td">
                        <Badge type={inv.status} />
                      </td>
                      <td className="td">
                        <div className="flex gap-1">
                          <button
                            className="btn-ghost"
                            onClick={() => openEdit(inv)}
                          >
                            Edit
                          </button>
                          {!inv.isRevised && !inv.originalInvoiceId && (
                            <button
                              className="btn-ghost text-amber-600 dark:text-amber-400"
                              onClick={() => openRevise(inv)}
                            >
                              Revise
                            </button>
                          )}
                          <button
                            className="btn-ghost text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => del(inv.id)}
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showGen && (
        <Modal
          title="Generate invoices"
          onClose={() => setShowGen(false)}
          size="lg"
        >
          <div className="space-y-4">
            <FormGrid cols={3}>
              <FormField label="Month">
                <select
                  className="input"
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Year">
                <select
                  className="input"
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Invoice date">
                <input
                  className="input"
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                />
              </FormField>
            </FormGrid>

            <FormField
              label="Starting invoice number"
              hint="Each route gets the next number automatically"
            >
              <input
                className="input font-mono w-40"
                value={genStartNum}
                onChange={(e) => setGenStartNum(e.target.value)}
                placeholder="1433"
              />
            </FormField>

            <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
              <p className="label mb-3">Active routes — enter days worked</p>
              {routes.filter((r) => r.active && !r.suspended).length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No active routes. Add routes first.
                </p>
              ) : (
                <div className="space-y-2">
                  {routes
                    .filter((r) => r.active && !r.suspended)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              Route {r.number} — {r.name}
                            </p>
                            <p className="muted">PO: {r.poNumber || "—"}</p>
                          </div>
                          {(!r.rateBands || r.rateBands.length === 0) && (
                            <div className="space-y-1.5 w-full">
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <input
                                    className="input w-20 text-center"
                                    type="number"
                                    min="0"
                                    placeholder="Days"
                                    value={genDays[r.id] || ""}
                                    onChange={(e) =>
                                      setGenDays((p) => ({
                                        ...p,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  {(() => {
                                    const attDays = getAttendanceDays(
                                      r.id,
                                      genMonth,
                                      genYear,
                                    );
                                    return attDays > 0 ? (
                                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                        📋 {attDays}d from register
                                      </p>
                                    ) : null;
                                  })()}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 text-right">
                                  {genDays[r.id]
                                    ? fmt(Number(genDays[r.id]) * r.dailyRate)
                                    : "—"}
                                </span>
                              </div>
                              {/* Partial month note — shown when days look fewer than expected */}
                              <input
                                className="input text-xs py-1"
                                value={genNotes[r.id] || ""}
                                onChange={(e) =>
                                  setGenNotes((p) => ({
                                    ...p,
                                    [r.id]: e.target.value,
                                  }))
                                }
                                placeholder="Note (optional) e.g. Route cancelled from 15th — 8 days only"
                              />
                            </div>
                          )}
                        </div>
                        {r.rateBands?.length > 0 &&
                          (() => {
                            const additiveBands = r.rateBands.filter(
                              (b) => b.isAdditive,
                            );
                            const replacementBands = r.rateBands.filter(
                              (b) => !b.isAdditive,
                            );
                            const allAdditive =
                              replacementBands.length === 0 &&
                              additiveBands.length > 0;
                            return (
                              <div className="space-y-1.5 pt-1">
                                {/* If all bands are additive, show standard days field too */}
                                {allAdditive && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">
                                      Standard run ({fmt(r.dailyRate)}/day)
                                    </span>
                                    <div className="text-right">
                                      <input
                                        className="input w-20 text-center"
                                        type="number"
                                        min="0"
                                        placeholder="Days"
                                        value={genDays[r.id] || ""}
                                        onChange={(e) =>
                                          setGenDays((p) => ({
                                            ...p,
                                            [r.id]: e.target.value,
                                          }))
                                        }
                                      />
                                      {(() => {
                                        const attDays = getAttendanceDays(
                                          r.id,
                                          genMonth,
                                          genYear,
                                        );
                                        return attDays > 0 ? (
                                          <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                                            📋 {attDays}d from register
                                          </p>
                                        ) : null;
                                      })()}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 text-right">
                                      {genDays[r.id]
                                        ? fmt(
                                            Number(genDays[r.id]) * r.dailyRate,
                                          )
                                        : "—"}
                                    </span>
                                  </div>
                                )}
                                {/* All rate bands */}
                                {r.rateBands.map((b) => (
                                  <div
                                    key={b.id}
                                    className="flex items-center gap-3"
                                  >
                                    <span
                                      className={`text-xs flex-1 truncate ${b.isAdditive ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}
                                    >
                                      {b.isAdditive ? "+ " : ""}
                                      {b.description}
                                      {b.isAdditive && (
                                        <span className="ml-1 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1 rounded">
                                          add-on
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 w-20 text-right">
                                      {fmt(b.wsccRate)}/day
                                    </span>
                                    <input
                                      className="input w-20 text-center"
                                      type="number"
                                      min="0"
                                      placeholder="Days"
                                      value={genBandDays[r.id]?.[b.id] || ""}
                                      onChange={(e) =>
                                        setGenBandDays((p) => ({
                                          ...p,
                                          [r.id]: {
                                            ...(p[r.id] || {}),
                                            [b.id]: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 text-right">
                                      {genBandDays[r.id]?.[b.id]
                                        ? fmt(
                                            Number(genBandDays[r.id][b.id]) *
                                              Number(b.wsccRate),
                                          )
                                        : "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={() => setShowGen(false)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={
                !genStartNum ||
                routes.filter(
                  (r) =>
                    r.active &&
                    !r.suspended &&
                    (genDays[r.id] ||
                      Object.keys(genBandDays[r.id] || {}).length > 0),
                ).length === 0
              }
              onClick={() => {
                const toGenerate = routes.filter(
                  (r) =>
                    r.active &&
                    (genDays[r.id] ||
                      Object.keys(genBandDays[r.id] || {}).length > 0),
                );
                const newInvoices = [];

                toGenerate.forEach((r, i) => {
                  const invNumber = String(parseInt(genStartNum) + i);
                  const vatRate = Number(settings?.vatRate || 20);
                  const bands = genBandDays[r.id] || {};
                  const usesBands =
                    r.rateBands?.length > 0 && Object.keys(bands).length > 0;

                  let netTotal, daysWorked, unitPrice;
                  if (usesBands) {
                    const allAdditive = r.rateBands.every((b) => b.isAdditive);
                    // Standard days (only for all-additive band routes)
                    const stdDays = allAdditive
                      ? Number(genDays[r.id] || 0)
                      : 0;
                    const stdAmount = stdDays * Number(r.dailyRate);
                    // Band amounts
                    const bandAmount = r.rateBands
                      .filter((b) => bands[b.id] && Number(bands[b.id]) > 0)
                      .reduce(
                        (s, b) =>
                          s +
                          Math.round(
                            Number(bands[b.id]) * Number(b.wsccRate) * 100,
                          ) /
                            100,
                        0,
                      );
                    const bandDays = r.rateBands.reduce(
                      (s, b) => s + (Number(bands[b.id]) || 0),
                      0,
                    );
                    netTotal = Math.round((stdAmount + bandAmount) * 100) / 100;
                    daysWorked = stdDays + bandDays;
                    unitPrice = daysWorked > 0 ? netTotal / daysWorked : 0;
                  } else {
                    daysWorked = Number(genDays[r.id] || 0);
                    unitPrice = Number(r.dailyRate);
                    netTotal = Math.round(daysWorked * unitPrice * 100) / 100;
                  }

                  const vat =
                    Math.round(netTotal * (vatRate / 100) * 100) / 100;
                  const total = Math.round((netTotal + vat) * 100) / 100;

                  // Generate the PDF
                  generateInvoicePDF({
                    invoiceNumber: invNumber,
                    route: r,
                    settings,
                    daysWorked,
                    invoiceDate: new Date(genDate).toLocaleDateString("en-GB"),
                    month: genMonth,
                    year: genYear,
                    bands,
                    notes: genNotes[r.id] || "",
                  });

                  // Build invoice record
                  newInvoices.push({
                    id: uid(),
                    invoiceNumber: invNumber,
                    poNumber: r.poNumber || "",
                    invoiceDate: genDate,
                    month: genMonth,
                    year: genYear,
                    routeNumber: r.number,
                    routeName: r.name,
                    daysWorked,
                    unitPrice: Math.round(unitPrice * 100) / 100,
                    netTotal,
                    vat,
                    total,
                    status: "unpaid",
                    paidAmount: 0,
                    fileName: "",
                    notes: genNotes[r.id] || "",
                    createdAt: Date.now(),
                  });
                });

                // Check for duplicates before saving
                const existing = new Set(invoices.map((x) => x.invoiceNumber));
                const duplicates = newInvoices.filter((x) =>
                  existing.has(x.invoiceNumber),
                );
                const fresh = newInvoices.filter(
                  (x) => !existing.has(x.invoiceNumber),
                );

                if (duplicates.length > 0) {
                  const nums = duplicates
                    .map((x) => `#${x.invoiceNumber}`)
                    .join(", ");
                  const proceed = confirm(
                    `⚠ ${duplicates.length} invoice(s) already exist: ${nums}\n\nSkip duplicates and save ${fresh.length} new invoice(s)?`,
                  );
                  if (!proceed) return;
                }

                if (fresh.length > 0) {
                  setInvoices([...invoices, ...fresh]);
                }

                setShowGen(false);
              }}
            >
              Generate{" "}
              {routes.filter(
                (r) =>
                  r.active &&
                  !r.suspended &&
                  (genDays[r.id] ||
                    Object.keys(genBandDays[r.id] || {}).length > 0),
              ).length || ""}{" "}
              PDF
              {routes.filter(
                (r) =>
                  r.active &&
                  !r.suspended &&
                  (genDays[r.id] ||
                    Object.keys(genBandDays[r.id] || {}).length > 0),
              ).length !== 1
                ? "s"
                : ""}
            </button>
          </ModalFooter>
        </Modal>
      )}

      {showModal && (
        <Modal
          title={editing ? `Edit #${form.invoiceNumber}` : "Add invoice"}
          onClose={close}
          size="lg"
        >
          <div className="space-y-4">
            <FormGrid cols={3}>
              <FormField label="Invoice number *">
                <input
                  className={`input font-mono ${formErrors.invoiceNumber ? "border-red-400 dark:border-red-600" : ""}`}
                  value={form.invoiceNumber}
                  onChange={f("invoiceNumber")}
                  placeholder="1407"
                />
                {formErrors.invoiceNumber && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {formErrors.invoiceNumber}
                  </p>
                )}
              </FormField>
              <FormField label="Invoice date">
                <input
                  className="input"
                  type="date"
                  value={form.invoiceDate || ""}
                  onChange={f("invoiceDate")}
                />
              </FormField>
              <FormField label="PO number">
                <input
                  className="input font-mono"
                  value={form.poNumber}
                  onChange={f("poNumber")}
                  placeholder="WSP000000786"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Route number">
                <input
                  className="input"
                  value={form.routeNumber}
                  onChange={f("routeNumber")}
                  placeholder="50540"
                />
              </FormField>
              <FormField label="Route name">
                <input
                  className="input"
                  value={form.routeName}
                  onChange={f("routeName")}
                  placeholder="Philpots taxi"
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Month">
                <select
                  className="input"
                  value={form.month}
                  onChange={f("month")}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Year">
                <select
                  className="input"
                  value={form.year}
                  onChange={f("year")}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </FormField>
            </FormGrid>
            <FormGrid cols={3}>
              <FormField label="Days worked">
                <input
                  className="input"
                  type="number"
                  value={form.daysWorked}
                  onChange={f("daysWorked")}
                />
              </FormField>
              <FormField label="Unit price (£)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.unitPrice}
                  onChange={f("unitPrice")}
                />
              </FormField>
              <FormField label="Net total (£)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.netTotal}
                  onChange={f("netTotal")}
                />
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="VAT (£)">
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  value={form.vat}
                  onChange={f("vat")}
                />
              </FormField>
              <FormField label="Total (£) *">
                <input
                  className={`input ${formErrors.total ? "border-red-400 dark:border-red-600" : ""}`}
                  type="number"
                  step="0.01"
                  value={form.total}
                  onChange={f("total")}
                />
                {formErrors.total && (
                  <p className="text-xs text-red-500 mt-0.5">
                    {formErrors.total}
                  </p>
                )}
              </FormField>
            </FormGrid>
            <FormGrid cols={2}>
              <FormField label="Status">
                <select
                  className="input"
                  value={form.status}
                  onChange={f("status")}
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </FormField>
              {form.status === "partial" && (
                <FormField label="Amount received (£)">
                  <input
                    className={`input ${formErrors.paidAmount ? "border-red-400 dark:border-red-600" : ""}`}
                    type="number"
                    step="0.01"
                    value={form.paidAmount}
                    onChange={f("paidAmount")}
                  />
                  {formErrors.paidAmount && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {formErrors.paidAmount}
                    </p>
                  )}
                </FormField>
              )}
            </FormGrid>
          </div>
          <ModalFooter>
            <button className="btn-secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveManual}>
              Save invoice
            </button>
          </ModalFooter>
        </Modal>
      )}
      {showRevise && revising && (
        <Modal
          title={`Revise invoice #${revising.invoiceNumber}`}
          onClose={() => setShowRevise(false)}
          size="md"
        >
          <div className="space-y-4">
            <div className="alert-warn text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">What this does:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>
                  Marks{" "}
                  <span className="font-mono">#{revising.invoiceNumber}</span>{" "}
                  as superseded
                </li>
                <li>
                  Creates{" "}
                  <span className="font-mono">
                    #{revising.invoiceNumber}-R1
                  </span>{" "}
                  as a copy
                </li>
                <li>Opens the copy so you can correct the details</li>
              </ul>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Original invoice
                </span>
                <span className="font-mono font-semibold">
                  #{revising.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Route</span>
                <span>
                  Route {revising.routeNumber} — {revising.routeName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total</span>
                <span className="font-semibold">{fmt(revising.total)}</span>
              </div>
            </div>
            <FormField label="Reason for revision">
              <input
                className="input"
                value={reviseNote}
                onChange={(e) => setReviseNote(e.target.value)}
                placeholder="e.g. Wrong number of days — corrected from 22 to 20"
              />
            </FormField>
          </div>
          <ModalFooter>
            <button
              className="btn-secondary"
              onClick={() => setShowRevise(false)}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={saveRevision}>
              Create revision
            </button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
