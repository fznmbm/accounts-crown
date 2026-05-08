import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
export const AUTH_STORAGE_KEY = `sb-${projectRef}-auth-token`;

// Module-level singleton — ES modules are cached by Vite,
// so this variable persists across HMR re-evaluations.
// Using a module-level variable is more reliable than window in Vite.
let _client = null;

const getClient = () => {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _client;
};

export const supabase = getClient();
