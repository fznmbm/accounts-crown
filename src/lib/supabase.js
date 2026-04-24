import { createClient } from "@supabase/supabase-js";

// const SUPABASE_URL = "https://jgmxdfapwayoamynrxbd.supabase.co";
// const SUPABASE_ANON =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbXhkZmFwd2F5b2FteW5yeGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDk2MzMsImV4cCI6MjA5MjQyNTYzM30.39fX7DcaUiO0QysZpexNEfEk_SZjQD52E60I2w-UFCQ";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
