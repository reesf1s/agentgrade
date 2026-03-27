import { createClient } from "@supabase/supabase-js";

function decodeProjectRefFromSupabaseKey(key: string | undefined): string | null {
  if (!key) {
    return null;
  }

  try {
    const [, payload] = key.split(".");
    if (!payload) {
      return null;
    }

    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      ref?: string;
    };

    return typeof json.ref === "string" ? json.ref : null;
  } catch {
    return null;
  }
}

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "missing-anon-key";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const derivedProjectRef =
  decodeProjectRefFromSupabaseKey(supabaseServiceKey) ||
  decodeProjectRefFromSupabaseKey(supabaseAnonKey);

const derivedSupabaseUrl = derivedProjectRef
  ? `https://${derivedProjectRef}.supabase.co`
  : null;

const configuredHost = configuredSupabaseUrl
  ? (() => {
      try {
        return new URL(configuredSupabaseUrl).hostname;
      } catch {
        return null;
      }
    })()
  : null;

const urlMatchesDerivedProject =
  !!configuredHost && !!derivedProjectRef && configuredHost.startsWith(`${derivedProjectRef}.`);

const supabaseUrl =
  configuredSupabaseUrl && (!derivedSupabaseUrl || urlMatchesDerivedProject)
    ? configuredSupabaseUrl
    : derivedSupabaseUrl || configuredSupabaseUrl || "https://agentgrade-missing-env.supabase.co";

const adminKey = supabaseServiceKey || supabaseAnonKey;
let hasWarnedAboutPublicEnv = false;
let hasWarnedAboutServiceRole = false;
let hasWarnedAboutUrlMismatch = false;

if (!hasWarnedAboutPublicEnv && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  hasWarnedAboutPublicEnv = true;
  console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not fully configured.");
}

if (!hasWarnedAboutServiceRole && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  hasWarnedAboutServiceRole = true;
  console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. Server writes will use the anon key and may fail.");
}

if (!hasWarnedAboutUrlMismatch && configuredSupabaseUrl && derivedSupabaseUrl && !urlMatchesDerivedProject) {
  hasWarnedAboutUrlMismatch = true;
  console.warn(
    `[supabase] NEXT_PUBLIC_SUPABASE_URL does not match the Supabase project ref encoded in the API key. Using ${derivedSupabaseUrl} instead of ${configuredSupabaseUrl}.`
  );
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
