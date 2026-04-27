import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export const DEFAULT_SETTINGS = {
  companyName: "Crown Cars Ltd",
  logoUrl: "",
  address: "1 John Brackpool Close, Crawley, RH10 8FA",
  phone: "01444 300315",
  email: "crowncarslimited@gmail.com",
  vatNumber: "329462388",
  accountName: "Crown Cars Ltd",
  accountNo: "48755760",
  sortCode: "30-99-50",
  supplierNumber: "103820",
  vatRate: 20,
};

// ── camelCase ↔ snake_case mappers ──────────────────────────────────────────
const routeFromDb = (r) => ({
  id: r.id,
  number: r.number,
  name: r.name,
  poNumber: r.po_number,
  school: r.school,
  primaryDriverId: r.primary_driver_id,
  primaryPAId: r.primary_pa_id,
  dailyRate: r.daily_rate,
  driverDailyRate: r.driver_daily_rate,
  active: r.active,
  suspended: r.suspended || false,
  operationalDays: r.operational_days || [1, 2, 3, 4, 5],
  notes: r.notes,
  documents: r.documents || [],
  createdAt: r.created_at,
});
const routeToDb = (r, uid) => ({
  id: r.id,
  user_id: uid,
  number: r.number,
  name: r.name,
  po_number: r.poNumber,
  school: r.school,
  primary_driver_id: r.primaryDriverId,
  primary_pa_id: r.primaryPAId,
  daily_rate: r.dailyRate,
  driver_daily_rate: r.driverDailyRate,
  active: r.active,
  suspended: r.suspended || false,
  operational_days: r.operationalDays || [1, 2, 3, 4, 5],
  notes: r.notes,
  documents: r.documents || [],
  created_at: r.createdAt,
});

const invoiceFromDb = (x) => ({
  id: x.id,
  invoiceNumber: x.invoice_number,
  poNumber: x.po_number,
  invoiceDate: x.invoice_date,
  month: x.month,
  year: x.year,
  routeNumber: x.route_number,
  routeName: x.route_name,
  daysWorked: x.days_worked,
  unitPrice: x.unit_price,
  netTotal: x.net_total,
  vat: x.vat,
  total: x.total,
  status: x.status,
  paidAmount: x.paid_amount,
  remittanceId: x.remittance_id,
  fileName: x.file_name,
  isRevised: x.is_revised || false,
  revisedBy: x.revised_by || null,
  revisionNote: x.revision_note || "",
  originalInvoiceId: x.original_invoice_id || null,
  createdAt: x.created_at,
  notes: x.notes || "",
});
const invoiceToDb = (x, uid) => ({
  id: x.id,
  user_id: uid,
  invoice_number: x.invoiceNumber,
  po_number: x.poNumber,
  invoice_date: x.invoiceDate,
  month: x.month,
  year: x.year,
  route_number: x.routeNumber,
  route_name: x.routeName,
  days_worked: x.daysWorked,
  unit_price: x.unitPrice,
  net_total: x.netTotal,
  vat: x.vat,
  total: x.total,
  status: x.status,
  paid_amount: x.paidAmount,
  remittance_id: x.remittanceId,
  file_name: x.fileName,
  is_revised: x.isRevised || false,
  revised_by: x.revisedBy || null,
  revision_note: x.revisionNote || "",
  original_invoice_id: x.originalInvoiceId || null,
  created_at: x.createdAt,
  notes: x.notes || "",
});

const staffFromDb = (s) => ({
  id: s.id,
  name: s.name,
  type: s.type,
  phone: s.phone,
  email: s.email,
  bankName: s.bank_name,
  accountNo: s.account_no,
  sortCode: s.sort_code,
  notes: s.notes,
  createdAt: s.created_at,
});
const staffToDb = (s, uid) => ({
  id: s.id,
  user_id: uid,
  name: s.name,
  type: s.type,
  phone: s.phone,
  email: s.email,
  bank_name: s.bankName,
  account_no: s.accountNo,
  sort_code: s.sortCode,
  notes: s.notes,
  created_at: s.createdAt,
});

const paymentFromDb = (p) => ({
  id: p.id,
  staffId: p.staff_id,
  amount: p.amount,
  date: p.date,
  type: p.type,
  month: p.month,
  year: p.year,
  reference: p.reference,
  notes: p.notes,
  allocationIds: p.allocation_ids || [],
  periodMonth: p.period_month ?? null,
  periodYear: p.period_year ?? null,
  isExternal: p.is_external || false,
  externalName: p.external_name || "",
  createdAt: p.created_at,
});
const paymentToDb = (p, uid) => ({
  id: p.id,
  user_id: uid,
  staff_id: p.staffId,
  amount: p.amount,
  date: p.date,
  type: p.type,
  month: p.month,
  year: p.year,
  reference: p.reference,
  notes: p.notes,
  allocation_ids: p.allocationIds || [],
  period_month: p.periodMonth ?? null,
  period_year: p.periodYear ?? null,
  is_external: p.isExternal || false,
  external_name: p.externalName || null,
  created_at: p.createdAt,
});

const remittanceFromDb = (r) => ({
  id: r.id,
  paymentNumber: r.payment_number,
  total: r.total,
  paymentDate: r.payment_date,
  items: r.items,
  fileName: r.file_name,
  createdAt: r.created_at,
});
const remittanceToDb = (r, uid) => ({
  id: r.id,
  user_id: uid,
  payment_number: r.paymentNumber,
  total: r.total,
  payment_date: r.paymentDate,
  items: r.items,
  file_name: r.fileName,
  created_at: r.createdAt,
});

// add after the remittanceToDb line
const allocationFromDb = (a) => ({
  id: a.id,
  routeId: a.route_id,
  routeNumber: a.route_number,
  routeName: a.route_name,
  month: a.month,
  year: a.year,
  totalDays: a.total_days,
  regularStaffId: a.regular_staff_id,
  regularDays: a.regular_days,
  regularRate: a.regular_rate,
  regularAmount: a.regular_amount,
  tempStaffId: a.temp_staff_id,
  tempStaffName: a.temp_staff_name,
  tempDays: a.temp_days,
  tempRate: a.temp_rate,
  tempAmount: a.temp_amount,
  coverEntries: a.cover_entries || [],
  absenceReason: a.absence_reason || "",
  notes: a.notes,
  createdAt: a.created_at,
});
const allocationToDb = (a, uid) => ({
  id: a.id,
  user_id: uid,
  route_id: a.routeId,
  route_number: a.routeNumber,
  route_name: a.routeName,
  month: a.month,
  year: a.year,
  total_days: a.totalDays,
  regular_staff_id: a.regularStaffId,
  regular_days: a.regularDays,
  regular_rate: a.regularRate,
  regular_amount: a.regularAmount,
  temp_staff_id: a.tempStaffId,
  temp_staff_name: a.tempStaffName,
  temp_days: a.tempDays,
  temp_rate: a.tempRate,
  temp_amount: a.tempAmount,
  cover_entries: a.coverEntries || [],
  absence_reason: a.absenceReason || "",
  notes: a.notes,
  created_at: a.createdAt,
});

const childFromDb = (c) => ({
  id: c.id,
  routeId: c.route_id,
  routeNumber: c.route_number,
  firstName: c.first_name,
  lastName: c.last_name,
  dateOfBirth: c.date_of_birth,
  schoolName: c.school_name,
  schoolAddress: c.school_address,
  travelDays: c.travel_days || [1, 2, 3, 4, 5],
  amPickupTime: c.am_pickup_time,
  pmPickupTime: c.pm_pickup_time,
  pickupAddresses: c.pickup_addresses || [],
  dropoffAddress: c.dropoff_address,
  amOnly: c.am_only || false,
  pmOnly: c.pm_only || false,
  afterschoolClubs: c.afterschool_clubs || [],
  requiresPA: c.requires_pa || false,
  paRequirements: c.pa_requirements,
  parentContacts: c.parent_contacts || [],
  carePlanNotes: c.care_plan_notes,
  medicalNotes: c.medical_notes,
  status: c.status || "active",
  startDate: c.start_date,
  endDate: c.end_date,
  notes: c.notes,
  createdAt: c.created_at,
});

const childToDb = (c, uid) => ({
  id: c.id,
  user_id: uid,
  route_id: c.routeId,
  route_number: c.routeNumber,
  first_name: c.firstName,
  last_name: c.lastName,
  date_of_birth: c.dateOfBirth,
  school_name: c.schoolName,
  school_address: c.schoolAddress,
  travel_days: c.travelDays || [1, 2, 3, 4, 5],
  am_pickup_time: c.amPickupTime,
  pm_pickup_time: c.pmPickupTime,
  pickup_addresses: c.pickupAddresses || [],
  dropoff_address: c.dropoffAddress,
  am_only: c.amOnly || false,
  pm_only: c.pmOnly || false,
  afterschool_clubs: c.afterschoolClubs || [],
  requires_pa: c.requiresPA || false,
  pa_requirements: c.paRequirements,
  parent_contacts: c.parentContacts || [],
  care_plan_notes: c.carePlanNotes,
  medical_notes: c.medicalNotes,
  status: c.status || "active",
  start_date: c.startDate,
  end_date: c.endDate,
  notes: c.notes,
  created_at: c.createdAt,
});

const attendanceFromDb = (a) => ({
  id: a.id,
  month: a.month,
  year: a.year,
  date: a.date,
  routeId: a.route_id,
  routeNumber: a.route_number,
  status: a.status || "ran",
  daysValue: a.days_value ?? 1,
  isSplitRun: a.is_split_run || false,
  amDriverId: a.am_driver_id,
  amDriverName: a.am_driver_name,
  pmDriverId: a.pm_driver_id,
  pmDriverName: a.pm_driver_name,
  amPaId: a.am_pa_id || null,
  amPaName: a.am_pa_name || null,
  pmPaId: a.pm_pa_id || null,
  pmPaName: a.pm_pa_name || null,
  driverId: a.driver_id,
  driverName: a.driver_name,
  isCoverDriver: a.is_cover_driver || false,
  isExternalDriver: a.is_external_driver || false,
  externalDriverName: a.external_driver_name || "",
  isExternalPA: a.is_external_pa || false,
  externalPAName: a.external_pa_name || "",
  paId: a.pa_id,
  paName: a.pa_name,
  isCoverPA: a.is_cover_pa || false,
  childrenAttendance: a.children_attendance || [],
  noRunReason: a.no_run_reason,
  notes: a.notes,

  createdAt: a.created_at,
});

const attendanceToDb = (a, uid) => ({
  id: a.id,
  user_id: uid,
  month: a.month,
  year: a.year,
  date: a.date,
  route_id: a.routeId,
  route_number: a.routeNumber,
  status: a.status || "ran",
  days_value: a.daysValue ?? 1,
  is_split_run: a.isSplitRun || false,
  am_driver_id: a.amDriverId || null,
  am_driver_name: a.amDriverName || null,
  pm_driver_id: a.pmDriverId || null,
  pm_driver_name: a.pmDriverName || null,
  am_pa_id: a.amPaId || null,
  am_pa_name: a.amPaName || null,
  pm_pa_id: a.pmPaId || null,
  pm_pa_name: a.pmPaName || null,
  driver_id: a.driverId,
  driver_name: a.driverName,
  is_cover_driver: a.isCoverDriver || false,
  is_external_driver: a.isExternalDriver || false,
  external_driver_name: a.externalDriverName || null,
  is_external_pa: a.isExternalPA || false,
  external_pa_name: a.externalPAName || null,
  pa_id: a.paId,
  pa_name: a.paName,
  is_cover_pa: a.isCoverPA || false,
  children_attendance: a.childrenAttendance || [],
  no_run_reason: a.noRunReason,
  notes: a.notes,

  created_at: a.createdAt,
});

const holidayFromDb = (h) => ({
  id: h.id,
  date: h.date,
  label: h.label,
  type: h.type || "school_holiday",
  allRoutes: h.all_routes ?? true,
  routeIds: h.route_ids || [],
  month: h.month,
  year: h.year,
  createdAt: h.created_at,
});

const holidayToDb = (h, uid) => ({
  id: h.id,
  user_id: uid,
  date: h.date,
  label: h.label,
  type: h.type || "school_holiday",
  all_routes: h.allRoutes ?? true,
  route_ids: h.routeIds || [],
  month: h.month,
  year: h.year,
  created_at: h.createdAt,
});

const poHistoryFromDb = (p) => ({
  id: p.id,
  routeId: p.route_id,
  routeNumber: p.route_number,
  poNumber: p.po_number,
  startDate: p.start_date,
  endDate: p.end_date,
  notes: p.notes,
  createdAt: p.created_at,
});
const poHistoryToDb = (p, uid) => ({
  id: p.id,
  user_id: uid,
  route_id: p.routeId,
  route_number: p.routeNumber,
  po_number: p.poNumber,
  start_date: p.startDate,
  end_date: p.endDate,
  notes: p.notes,
  created_at: p.createdAt,
});

const auditFromDb = (a) => ({
  id: a.id,
  action: a.action,
  entity: a.entity,
  entityId: a.entity_id,
  entityLabel: a.entity_label,
  changes: a.changes,
  createdAt: a.created_at,
});

const auditToDb = (a, uid) => ({
  id: a.id,
  user_id: uid,
  action: a.action,
  entity: a.entity,
  entity_id: a.entityId,
  entity_label: a.entityLabel,
  changes: a.changes,
  created_at: a.createdAt,
});

// ── sync helper: replace all rows for user in a table ────────────────────────
async function syncTable(table, data, toDb, userId) {
  await supabase.from(table).delete().eq("user_id", userId);
  if (data.length > 0) {
    const { error } = await supabase
      .from(table)
      .insert(data.map((r) => toDb(r, userId)));
    if (error) console.error(`syncTable ${table}:`, error);
  }
}

async function syncSettings(data, userId) {
  await supabase.from("settings").upsert({ id: userId, user_id: userId, data });
}

// ── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user } = useAuth();

  const [routes, setRawRoutes] = useState([]);
  const [invoices, setRawInvoices] = useState([]);
  const [staff, setRawStaff] = useState([]);
  const [payments, setRawPayments] = useState([]);
  const [remittances, setRawRemittances] = useState([]);
  const [allocations, setRawAllocations] = useState([]);
  const [poHistory, setRawPoHistory] = useState([]);
  const [auditLog, setRawAuditLog] = useState([]);
  const [pupils, setRawPupils] = useState([]);
  const [attendance, setRawAttendance] = useState([]);
  const [holidays, setRawHolidays] = useState([]);
  const [settings, setRawSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // ── Load all data on mount ─────────────────────────────────────────────────
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (hasLoadedRef.current) return; // prevent re-run on token refresh
    hasLoadedRef.current = true;
    const uid = user.id;

    async function loadAll() {
      setLoading(true);
      try {
        const [r, inv, st, pay, rem, sett, alloc, poh, audit, ch, att, hol] =
          await Promise.all([
            supabase.from("routes").select("*").eq("user_id", uid),
            supabase.from("invoices").select("*").eq("user_id", uid),
            supabase.from("staff").select("*").eq("user_id", uid),
            supabase.from("payments").select("*").eq("user_id", uid),
            supabase.from("remittances").select("*").eq("user_id", uid),
            supabase
              .from("settings")
              .select("*")
              .eq("user_id", uid)
              .maybeSingle(),
            supabase.from("allocations").select("*").eq("user_id", uid),
            supabase.from("po_history").select("*").eq("user_id", uid),
            supabase
              .from("audit_log")
              .select("*")
              .eq("user_id", uid)
              .order("created_at", { ascending: false })
              .limit(200),
            supabase.from("children").select("*").eq("user_id", uid),
            supabase.from("attendance").select("*").eq("user_id", uid),
            supabase.from("school_holidays").select("*").eq("user_id", uid),
          ]);
        setRawRoutes((r.data || []).map(routeFromDb));
        setRawInvoices((inv.data || []).map(invoiceFromDb));
        setRawStaff((st.data || []).map(staffFromDb));
        setRawPayments((pay.data || []).map(paymentFromDb));
        setRawRemittances((rem.data || []).map(remittanceFromDb));
        setRawSettings(sett.data?.data || DEFAULT_SETTINGS);
        setRawAllocations((alloc.data || []).map(allocationFromDb));
        setRawPoHistory((poh.data || []).map(poHistoryFromDb));
        if (poh.error) console.error("po_history:", poh.error);

        setRawAuditLog((audit.data || []).map(auditFromDb));
        if (audit.error) console.error("audit_log:", audit.error);

        setRawPupils((ch.data || []).map(childFromDb));
        if (ch.error) console.error("children:", ch.error);

        setRawAttendance((att.data || []).map(attendanceFromDb));
        if (att.error) console.error("attendance:", att.error);

        setRawHolidays((hol.data || []).map(holidayFromDb));
        if (hol.error) console.error("school_holidays:", hol.error);

        if (r.error) console.error("routes:", r.error);
        if (inv.error) console.error("invoices:", inv.error);
        if (st.error) console.error("staff:", st.error);
        if (pay.error) console.error("payments:", pay.error);
        if (rem.error) console.error("remittances:", rem.error);
        if (alloc.error) console.error("allocations:", alloc.error);
      } catch (e) {
        console.error("loadAll failed:", e);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [user]);

  // ── Setters — update state + sync to Supabase ──────────────────────────────
  const setRoutes = async (data, audit) => {
    setRawRoutes(data);
    await syncTable("routes", data, routeToDb, user.id);
    if (audit)
      await addAuditEntry(
        audit.action,
        "route",
        audit.id,
        audit.label,
        audit.changes,
      );
  };
  const setInvoices = async (data, audit) => {
    setRawInvoices(data);
    await syncTable("invoices", data, invoiceToDb, user.id);
    if (audit)
      await addAuditEntry(
        audit.action,
        "invoice",
        audit.id,
        audit.label,
        audit.changes,
      );
  };
  const setStaff = async (data, audit) => {
    setRawStaff(data);
    await syncTable("staff", data, staffToDb, user.id);
    if (audit)
      await addAuditEntry(
        audit.action,
        "staff",
        audit.id,
        audit.label,
        audit.changes,
      );
  };
  const setPayments = async (data, audit) => {
    setRawPayments(data);
    await syncTable("payments", data, paymentToDb, user.id);
    if (audit)
      await addAuditEntry(
        audit.action,
        "payment",
        audit.id,
        audit.label,
        audit.changes,
      );
  };
  const setRemittances = async (data) => {
    setRawRemittances(data);
    await syncTable("remittances", data, remittanceToDb, user.id);
  };

  const setAllocations = async (data) => {
    setRawAllocations(data);
    await syncTable("allocations", data, allocationToDb, user.id);
  };
  const setPoHistory = async (data) => {
    setRawPoHistory(data);
    await syncTable("po_history", data, poHistoryToDb, user.id);
  };

  const setPupils = async (data) => {
    setRawPupils(data);
    await syncTable("children", data, childToDb, user.id);
  };

  const setAttendance = async (data) => {
    setRawAttendance(data);
    if (data.length === 0) {
      await supabase.from("attendance").delete().eq("user_id", user.id);
      return;
    }
    const rows = data.map((a) => attendanceToDb(a, user.id));
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("attendance")
        .upsert(chunk, { onConflict: "id" });
      if (error) console.error("attendance upsert error:", error);
    }
  };

  const deleteAttendanceRecords = async (ids) => {
    if (!ids || ids.length === 0) return;
    for (const id of ids) {
      await supabase
        .from("attendance")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
    }
  };

  const setHolidays = async (data) => {
    setRawHolidays(data);
    await syncTable("school_holidays", data, holidayToDb, user.id);
  };

  const addAuditEntry = async (
    action,
    entity,
    entityId,
    entityLabel,
    changes = null,
  ) => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      action,
      entity,
      entityId,
      entityLabel,
      changes,
      createdAt: Date.now(),
    };
    const newLog = [entry, ...auditLog];
    setRawAuditLog(newLog);
    await supabase.from("audit_log").insert(auditToDb(entry, user.id));
  };
  const setSettings = async (data) => {
    setRawSettings(data);
    await syncSettings(data, user.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="text-sm text-gray-400 dark:text-gray-500">
          Loading your data…
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        routes,
        setRoutes,
        invoices,
        setInvoices,
        staff,
        setStaff,
        payments,
        setPayments,
        remittances,
        setRemittances,
        allocations,
        setAllocations,
        poHistory,
        setPoHistory,
        auditLog,
        addAuditEntry,
        pupils,
        setPupils,
        attendance,
        setAttendance,
        deleteAttendanceRecords,
        holidays,
        setHolidays,
        settings,
        setSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
};
