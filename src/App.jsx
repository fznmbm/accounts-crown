import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import RoutesPage from "./pages/Routes";
import Invoices from "./pages/Invoices";
import Remittances from "./pages/Remittances";
import Staff from "./pages/Staff";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Allocations from "./pages/Allocations";
import StaffLedger from "./pages/StaffLedger";
import AuditLog from "./pages/AuditLog";
import Children from "./pages/Children";
import Attendance from "./pages/Attendance";
import HolidayCalendar from "./pages/HolidayCalendar";
import AdminLicences from "./pages/AdminLicences";

function ProtectedRoutes() {
  const { user } = useAuth();
  if (!user) return <Login />;
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="remittances" element={<Remittances />} />
          <Route path="staff" element={<Staff />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="allocations" element={<Allocations />} />
          <Route path="staff-ledger" element={<StaffLedger />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="routes/:routeId/children" element={<Children />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="holidays" element={<HolidayCalendar />} />
          <Route path="/sys-admin-licences" element={<AdminLicences />} />
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="text-5xl mb-4">🔍</div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Page not found
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  The page you're looking for doesn't exist.
                </p>
                <a href="/dashboard" className="btn-primary">
                  Go to Dashboard
                </a>
              </div>
            }
          />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
