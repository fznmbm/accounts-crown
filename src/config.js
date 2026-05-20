// ═══════════════════════════════════════════════════════════════
// CROWN CARS SaaS — CLIENT CONFIGURATION
// All values come from environment variables.
// This file never changes per client — only Vercel env vars do.
// ═══════════════════════════════════════════════════════════════

export const CONFIG = {
  // ── Branding ─────────────────────────────────────────────────
  companyName: import.meta.env.VITE_COMPANY_NAME || "",
  companyInitials: import.meta.env.VITE_COMPANY_INITIALS || "",
  primaryColour: import.meta.env.VITE_PRIMARY_COLOUR || "#1d4ed8",
  councilName: import.meta.env.VITE_COUNCIL_NAME || "",
  supplierNumber: import.meta.env.VITE_SUPPLIER_NUMBER || "",

  // ── Licence key ──────────────────────────────────────────────
  licenceKey: import.meta.env.VITE_LICENCE_KEY || "",

  // ── Auth ─────────────────────────────────────────────────────
  ownerUserId: import.meta.env.VITE_OWNER_USER_ID || "",

  // ── Client's Supabase project ─────────────────────────────────
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
