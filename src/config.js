// ═══════════════════════════════════════════════════════════════
// CROWN CARS — CLIENT CONFIGURATION
// This is the ONLY file that changes per client deployment.
// ═══════════════════════════════════════════════════════════════

export const CONFIG = {
  // ── Branding ─────────────────────────────────────────────────
  companyName: "Crown Cars Ltd",
  companyInitials: "CC",
  logoUrl: "", // Direct image URL or Google Drive link
  primaryColour: "#1d4ed8", // Brand colour (hex) — used in sidebar + buttons
  councilName: "West Sussex County Council",
  supplierNumber: "103820", // or Vendor number

  // ── Licence key ──────────────────────────────────────────────
  // DO NOT share this key. Unique per client deployment.
  licenceKey: "CROWN-CARS-2026-LIVE",

  // ── Client's Supabase project ─────────────────────────────────
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,

  // ── Google Drive ──────────────────────────────────────────────
  googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
};
