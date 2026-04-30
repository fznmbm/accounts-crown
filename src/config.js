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
  ownerUserId: "3c75d949-0c40-4f0b-9b51-992686e0fe1b", // ← add this

  // ── Licence key ──────────────────────────────────────────────
  // DO NOT share this key. Unique per client deployment.
  licenceKey: "CROWN-CARS-2026-LIVE",

  // ── Client's Supabase project ─────────────────────────────────
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnon: import.meta.env.VITE_SUPABASE_ANON_KEY,

  // ── Google Drive ──────────────────────────────────────────────
  // googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  // googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
};
