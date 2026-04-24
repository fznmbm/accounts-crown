import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { fmt, MONTHS_SHORT } from "../lib/utils";

function highlight(text, query) {
  if (!query || !text) return text;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {String(text).slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700 text-gray-900 dark:text-gray-100 rounded px-0.5">
        {String(text).slice(idx, idx + query.length)}
      </mark>
      {String(text).slice(idx + query.length)}
    </>
  );
}

function search(query, { invoices, routes, staff, payments, allocations }) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  const res = [];

  // Invoices
  invoices.forEach((x) => {
    if (
      x.invoiceNumber?.toLowerCase().includes(q) ||
      x.routeNumber?.toLowerCase().includes(q) ||
      x.routeName?.toLowerCase().includes(q) ||
      x.poNumber?.toLowerCase().includes(q)
    ) {
      res.push({
        type: "Invoice",
        icon: "🧾",
        title: `Invoice #${x.invoiceNumber}`,
        sub: `Route ${x.routeNumber} · ${x.routeName} · ${MONTHS_SHORT[x.month]} ${x.year}`,
        meta: fmt(x.total),
        to: "/invoices",
        matchOn: x.invoiceNumber,
      });
    }
  });

  // Routes
  routes.forEach((r) => {
    if (
      r.number?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.poNumber?.toLowerCase().includes(q) ||
      r.school?.toLowerCase().includes(q)
    ) {
      res.push({
        type: "Route",
        icon: "🛣️",
        title: `Route ${r.number} — ${r.name}`,
        sub: `${r.school || "No school"} · PO: ${r.poNumber || "—"}`,
        meta: r.active ? (r.suspended ? "Suspended" : "Active") : "Inactive",
        to: "/routes",
        matchOn: r.number,
      });
    }
  });

  // Staff
  staff.forEach((s) => {
    if (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    ) {
      res.push({
        type: "Staff",
        icon: "👤",
        title: s.name,
        sub: `${s.type?.replace("_", " ")} · ${s.email || s.phone || "No contact"}`,
        meta: "",
        to: "/staff",
        matchOn: s.name,
      });
    }
  });

  // Payments
  payments.forEach((p) => {
    const name = staff.find((s) => s.id === p.staffId)?.name || "Unknown";
    if (
      name.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q)
    ) {
      res.push({
        type: "Payment",
        icon: "💷",
        title: `Payment to ${name}`,
        sub: `${MONTHS_SHORT[p.month]} ${p.year} · ${p.reference || p.type}`,
        meta: fmt(p.amount),
        to: "/payments",
        matchOn: name,
      });
    }
  });

  // Allocations
  allocations.forEach((a) => {
    const name = staff.find((s) => s.id === a.regularStaffId)?.name || "";
    if (
      a.routeNumber?.toLowerCase().includes(q) ||
      a.routeName?.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q)
    ) {
      res.push({
        type: "Allocation",
        icon: "📋",
        title: `Route ${a.routeNumber} — ${a.routeName}`,
        sub: `${name} · ${MONTHS_SHORT[a.month]} ${a.year}`,
        meta: fmt((a.regularAmount || 0) + (a.tempAmount || 0)),
        to: "/allocations",
        matchOn: a.routeNumber,
      });
    }
  });

  return res.slice(0, 12);
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(0);
  const inputRef = useRef();
  const navigate = useNavigate();
  const data = useApp();
  const results = search(query, data);

  // Keyboard shortcut — Ctrl+K or Cmd+K
  useEffect(() => {
    const handle = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setFocused(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, 0));
    }
    if (e.key === "Enter" && results[focused]) {
      navigate(results[focused].to);
      setOpen(false);
      setQuery("");
    }
  };

  const go = (to) => {
    navigate(to);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          setQuery("");
          setFocused(0);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                   text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800
                   border border-gray-200 dark:border-gray-700
                   hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="flex-1 text-left text-xs">Search…</span>
        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
          ⌘K
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:shadow-black/50 border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-400 flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none"
                placeholder="Search invoices, routes, staff, payments…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFocused(0);
                }}
                onKeyDown={handleKey}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  Type at least 2 characters to search
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No results for "{query}"
                </div>
              ) : (
                <div className="py-1">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => go(r.to)}
                      onMouseEnter={() => setFocused(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        focused === i
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <span className="text-lg flex-shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {highlight(r.title, query)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {r.sub}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.meta && (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {r.meta}
                          </span>
                        )}
                        <span className="text-xs text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {r.type}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                <span>↑↓ navigate</span>
                <span>↵ go to page</span>
                <span>Esc close</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
