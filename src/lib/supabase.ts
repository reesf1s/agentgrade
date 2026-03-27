import { createClient } from "@supabase/supabase-js";

// Supabase project: glkvrweabeilwnrpzqxg
// Hardcoded fallback so the app works even when NEXT_PUBLIC_SUPABASE_URL is not set.
const SUPABASE_URL = "https://glkvrweabeilwnrpzqxg.supabase.co";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side client with service_role key — bypasses RLS.
// Use this in all API routes and server actions.
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  { auth: { persistSession: false } }
);

// Client-side Supabase (anon key, respects RLS).
// Only usable in browser contexts.
export const supabase = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : supabaseAdmin;
