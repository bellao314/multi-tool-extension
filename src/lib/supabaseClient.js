import { createClient } from "@supabase/supabase-js";

const viteEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;

// Support both the Vite frontend runtime and a standalone Node backend entrypoint.
const supabaseUrl =
  viteEnv?.VITE_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const supabaseAnonKey =
  viteEnv?.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before starting the app.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
