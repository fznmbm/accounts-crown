import { createClient } from "@supabase/supabase-js";

// Points to the PLATFORM project (Crown Cars) — not the client's own DB.
// Licences are managed centrally by the platform owner only.
const platformClient = createClient(
  import.meta.env.VITE_PLATFORM_SUPABASE_URL,
  import.meta.env.VITE_PLATFORM_ANON_KEY,
  {
    auth: {
      storageKey: "sb-platform-auth-token",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

// If the licence server can't be reached, allow 24 hours from the last good check
function offlineGrace() {
  const lastCheck = localStorage.getItem("cc_last_valid_check");
  if (lastCheck) {
    const hoursSince = (Date.now() - parseInt(lastCheck)) / 1000 / 60 / 60;
    if (hoursSince < 24) return { valid: true, reason: "offline_grace" };
  }
  return { valid: false, reason: "unreachable" };
}

export async function validateLicence(licenceKey) {
  try {
    // Checked through a database function that only returns this one key's
    // status — the licences table itself is not readable from outside
    const { data, error } = await platformClient.rpc("validate_licence", {
      p_key: licenceKey,
    });

    if (error) {
      console.error("Licence check failed:", error);
      return offlineGrace();
    }

    const licence = data?.[0];
    if (!licence) {
      return { valid: false, reason: "invalid_key" };
    }

    if (licence.status === "suspended") {
      return { valid: false, reason: "suspended", client: licence };
    }

    if (licence.status === "expired") {
      return { valid: false, reason: "expired", client: licence };
    }

    // Check expiry date
    if (licence.expires_at) {
      const expiry = new Date(licence.expires_at);
      if (expiry < new Date()) {
        return { valid: false, reason: "expired", client: licence };
      }
    }

    return { valid: true, client: licence };
  } catch (e) {
    console.error("Licence check failed:", e);
    return offlineGrace();
  }
}
