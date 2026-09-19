import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project's values."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Payment-provider return URLs (Dodo) can carry query params that look
    // like OAuth callback params. Without this, supabase-js's URL scan on
    // load can misinterpret them and clear a valid session, kicking a
    // just-paid user back to the signed-out landing page.
    detectSessionInUrl: false,
  },
});