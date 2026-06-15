import { createClient } from "@supabase/supabase-js";

// Set these in a .env file (see .env.example). Vite exposes VITE_* to the client.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
