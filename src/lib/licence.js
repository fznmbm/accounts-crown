import { createClient } from "@supabase/supabase-js";

// Points to the PLATFORM project (Crown Cars) — not the client's own DB.
// Licences are managed centrally by the platform owner only.
const platformClient = createClient(
  import.meta.env.VITE_PLATFORM_SUPABASE_URL,
  import.meta.env.VITE_PLATFORM_ANON_KEY,
);

export async function validateLicence(licenceKey) {
  try {
    const { data, error } = await platformClient
      .from("licences")
      .select("*")
      .eq("licence_key", licenceKey)
      .single();

    if (error || !data) {
      return { valid: false, reason: "invalid_key" };
    }

    if (data.status === "suspended") {
      return { valid: false, reason: "suspended", client: data };
    }

    if (data.status === "expired") {
      return { valid: false, reason: "expired", client: data };
    }

    // Check expiry date
    if (data.expires_at) {
      const expiry = new Date(data.expires_at);
      if (expiry < new Date()) {
        return { valid: false, reason: "expired", client: data };
      }
    }

    return { valid: true, client: data };
  } catch (e) {
    console.error("Licence check failed:", e);
    // If licence server unreachable, allow access for 24hrs
    // (prevents lockout if Supabase has downtime)
    const lastCheck = localStorage.getItem("cc_last_valid_check");
    if (lastCheck) {
      const hoursSince = (Date.now() - parseInt(lastCheck)) / 1000 / 60 / 60;
      if (hoursSince < 24) return { valid: true, reason: "offline_grace" };
    }
    return { valid: false, reason: "unreachable" };
  }
}
