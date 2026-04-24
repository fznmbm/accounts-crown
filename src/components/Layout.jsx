import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import GlobalSearch from "./GlobalSearch";
import { CONFIG } from "../config";
import { useApp } from "../context/AppContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/routes", label: "Routes" },
  { to: "/invoices", label: "Invoices" },
  { to: "/remittances", label: "Remittances" },
  { to: "/staff", label: "Staff" },
  { to: "/payments", label: "Staff Payments" },
  { to: "/reports", label: "Reports" },
  { to: "/allocations", label: "Allocations" },
  { to: "/staff-ledger", label: "Staff Ledger" },
  { to: "/attendance", label: "Attendance" },
  { to: "/holidays", label: "Holiday Calendar" },
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

export default function Layout() {
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { settings } = useApp();
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
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                WSCC · {CONFIG.supplierNumber || "103820"}
              </p>
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
                `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`
              }
            >
              {label}
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
