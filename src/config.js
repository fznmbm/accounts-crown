// ═══════════════════════════════════════════════════════════════
// CROWN CARS SaaS — CLIENT CONFIGURATION
// All values come from environment variables.
// This file never changes per client — only Vercel env vars do.
// ═══════════════════════════════════════════════════════════════

export const CONFIG = {
  // ── Branding ─────────────────────────────────────────────────
  companyName: import.meta.env.VITE_COMPANY_NAME || "Crown Cars Ltd",
  companyInitials: import.meta.env.VITE_COMPANY_INITIALS || "CC",
  primaryColour: import.meta.env.VITE_PRIMARY_COLOUR || "#1d4ed8",
  councilName:
    import.meta.env.VITE_COUNCIL_NAME || "West Sussex County Council",
  supplierNumber: import.meta.env.VITE_SUPPLIER_NUMBER || "103820",

  // ── Licence key ──────────────────────────────────────────────
  licenceKey: "CROWN-CARS-2026-LIVE",

  // ── Auth ─────────────────────────────────────────────────────
  ownerUserId:
    import.meta.env.VITE_OWNER_USER_ID ||
    "f3cf0783-92e2-4269-a7e1-e9b3db6203a3",

  // ── Client's Supabase project ─────────────────────────────────
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
