import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://glkvrweabeilwnrpzqxg.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use the best available key; fall back to a placeholder so module import
// doesn't throw at build time — actual DB calls will fail at runtime if no
// real key is configured (Vercel sets these via environment variables).
const adminKey = supabaseServiceKey || supabaseAnonKey || "placeholder-key-set-in-vercel-env";

// Server-side Supabase with service_role key (bypasses RLS).
// Used by all API routes / webhooks.
export const supabaseAdmin = createClient(
  supabaseUrl,
  adminKey,
  { auth: { persistSession: false } }
);

// Client-side Supabase (anon key, respects RLS).
// Only usable in browser contexts when NEXT_PUBLIC_SUPABASE_ANON_KEY is configured.
export const supabase = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : supabaseAdmin;
