import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://agentgrade-missing-env.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminKey = supabaseServiceKey || supabaseAnonKey;
let hasWarnedAboutPublicEnv = false;
let hasWarnedAboutServiceRole = false;

if (!hasWarnedAboutPublicEnv && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  hasWarnedAboutPublicEnv = true;
  console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not fully configured.");
}

if (!hasWarnedAboutServiceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  hasWarnedAboutServiceRole = true;
  console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. Server writes will use the anon key and may fail.");
}

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
