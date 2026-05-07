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
  ownerUserId:
    import.meta.env.VITE_OWNER_USER_ID ||
    "f3cf0783-92e2-4269-a7e1-e9b3db6203a3",

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
