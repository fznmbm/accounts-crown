import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import GlobalSearch from "./GlobalSearch";
import { CONFIG } from "../config";
import { useApp } from "../context/AppContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/attendance", label: "Attendance" },
  { to: "/holidays", label: "Holiday Calendar" },
  { to: "/routes", label: "Routes" },
  { to: "/invoices", label: "Invoices" },
  { to: "/remittances", label: "Remittances" },
  { to: "/allocations", label: "Allocations" },
  { to: "/staff", label: "Staff" },
  { to: "/payments", label: "Staff Payments" },
  { to: "/staff-ledger", label: "Staff Ledger" },
  { to: "/compliance", label: "Compliance" },
  { to: "/applications", label: "Applications" },
  { to: "/invoice-submissions", label: "Invoice Submissions" },
  { to: "/reports", label: "Reports" },
  { to: "/audit", label: "Audit Log" },
];

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// Shows whether changes are saving, saved or failed — always visible in the sidebar
function SaveIndicator() {
  const { saveState } = useApp();
  const [justSaved, setJustSaved] = useState(false);

  // Highlight "All changes saved" for 3 seconds after each successful save
  useEffect(() => {
    if (saveState.pending > 0 || saveState.failed || !saveState.at) return;
    setJustSaved(true);
    const t = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saveState.pending, saveState.failed, saveState.at]);

  if (!saveState.at) return null; // nothing saved yet this session

  let dot, text, textClass;
  if (saveState.pending > 0) {
    dot = "bg-amber-400 animate-pulse";
    text = "Saving…";
    textClass = "text-amber-600 dark:text-amber-400";
  } else if (saveState.failed) {
    dot = "bg-red-500";
    text = "Last change not saved";
    textClass = "text-red-600 dark:text-red-400 font-medium";
  } else {
    dot = "bg-green-500";
    text = "All changes saved";
    textClass = justSaved
      ? "text-green-600 dark:text-green-400"
      : "text-gray-400 dark:text-gray-500";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-1.5 text-xs"
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className={`transition-colors ${textClass}`}>{text}</span>
    </div>
  );
}

export default function Layout() {
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { settings, applications, submissions, billingRecipients } = useApp();
  const defaultRecipient =
    billingRecipients?.find((r) => r.isDefault) ||
    billingRecipients?.[0] ||
    null;
  const pendingCount =
    applications?.filter((a) => a.status === "pending").length || 0;
  const pendingSubmissions =
    submissions?.filter((s) => s.status === "submitted").length || 0;
  const logoUrl = settings?.logoUrl || CONFIG.logoUrl;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Sidebar ── */}
      <aside className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={CONFIG.companyName}
                className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: CONFIG.primaryColour }}
              >
                {CONFIG.companyInitials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {CONFIG.companyName}
              </p>
              {defaultRecipient && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight truncate">
                  {defaultRecipient.name}
                  {defaultRecipient.supplierRef
                    ? ` · ${defaultRecipient.supplierRef}`
                    : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-2 pt-2 pb-1">
          <GlobalSearch />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`
              }
            >
              <span>{label}</span>
              {label === "Applications" && pendingCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingCount}
                </span>
              )}
              {label === "Invoice Submissions" && pendingSubmissions > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingSubmissions}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: Settings + Theme toggle */}
        <div className="px-2 pb-3 space-y-0.5 border-t border-gray-100 dark:border-gray-800 pt-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
              }`
            }
          >
            Settings
          </NavLink>

          {/* Dark mode toggle */}
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm
                       text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                       hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <span>{dark ? "Light mode" : "Dark mode"}</span>
            <span className="text-gray-400 dark:text-gray-500">
              {dark ? <SunIcon /> : <MoonIcon />}
            </span>
          </button>

          {/* Save status */}
          <SaveIndicator />

          {/* User + logout */}
          <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 mt-1 pt-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-2">
              {user?.email}
            </p>
            <button
              onClick={logout}
              className="w-full text-left text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
