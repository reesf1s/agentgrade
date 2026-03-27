import { cookies, headers } from "next/headers";

const DEFAULT_CLERK_ISSUER = "https://on-pug-27.clerk.accounts.dev";

const DEFAULT_CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAscEBbmeStwgFwVIuLOFM
AilvmLmgM1u7sMK2C2IdqCpZTPsjgopihfvtUh1lMdVxbO/4XsHp0cqNZytRCPJ1
8qlz40OjFzGYCdbRIfy9g8bMLSKlrP3e3zVLTrYrY+jPJHOPD7CbjhmSU80WSsJW
Chg+wnZXjHV98xwSzLRi0tFD6PO2wggLlMUxRH4ub8/x39SJHw767amV82EQWB+T
APMFxviyGrGt75936wh1AxWRx1MP0p8BIZeQg5HDRctLpxlTl6N6QJ38BewIbcHp
66i/7oPSITJ3ff2Uipz4wjb4xsTL7F5sLCQiVId1VHj+Q8HV65YclfvBsAKH+YJH
wwIDAQAB
-----END PUBLIC KEY-----`;

interface ClerkSessionPayload {
  azp?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  sid?: string;
  sts?: string;
  sub?: string;
  v?: number;
}

interface CookieLike {
  name: string;
  value: string;
}

function getPayloadWithoutVerification(token: string): ClerkSessionPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  return decodeJson<ClerkSessionPayload>(parts[1]);
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJson<T>(value: string): T | null {
  try {
    const json = new TextDecoder().decode(base64UrlToUint8Array(value));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, "");
  const bytes = base64UrlToUint8Array(base64.replace(/\+/g, "-").replace(/\//g, "_"));
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function importClerkPublicKey() {
  const pem = (process.env.CLERK_JWT_KEY || DEFAULT_CLERK_JWT_KEY).trim();
  return crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );
}

function getAuthorizedParties(origin?: string) {
  const parties = new Set<string>();

  if (origin) {
    parties.add(origin.trim());
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    parties.add(process.env.NEXT_PUBLIC_APP_URL.trim());
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    parties.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`);
  }

  if (process.env.VERCEL_URL) {
    parties.add(`https://${process.env.VERCEL_URL.trim()}`);
  }

  parties.add("https://agentgrade.vercel.app");

  return parties;
}

function getExpectedIssuers() {
  const issuers = new Set<string>([DEFAULT_CLERK_ISSUER]);

  if (process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL) {
    issuers.add(process.env.NEXT_PUBLIC_CLERK_FRONTEND_API_URL.trim());
  }

  if (process.env.CLERK_FRONTEND_API_URL) {
    issuers.add(process.env.CLERK_FRONTEND_API_URL.trim());
  }

  return issuers;
}

export async function verifyClerkSessionToken(
  token: string | undefined,
  origin?: string,
): Promise<string | null> {
  if (!token) {
    return null;
  }

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      return null;
    }

    const header = decodeJson<{ alg?: string; typ?: string }>(encodedHeader);
    const payload = decodeJson<ClerkSessionPayload>(encodedPayload);

    if (!header || !payload || header.alg !== "RS256" || payload.sts !== "active" || !payload.sub) {
      return null;
    }

    const signature = toArrayBuffer(base64UrlToUint8Array(encodedSignature));
    const signedData = toArrayBuffer(new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
    const key = await importClerkPublicKey();
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedData);

    if (!verified) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if ((payload.nbf && now < payload.nbf) || (payload.exp && now >= payload.exp)) {
      return null;
    }

    const expectedIssuers = getExpectedIssuers();
    if (payload.iss && !expectedIssuers.has(payload.iss.trim())) {
      return null;
    }

    const authorizedParties = getAuthorizedParties(origin);
    if (payload.azp && !authorizedParties.has(payload.azp.trim())) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export function getCandidateSessionTokens(
  cookieValues: CookieLike[],
): string[] {
  return cookieValues
    .filter((cookie) => cookie.name === "__session" || cookie.name.startsWith("__session_"))
    .map((cookie) => cookie.value)
    .filter(Boolean)
    .sort((left, right) => {
      const leftExp = getPayloadWithoutVerification(left)?.exp ?? 0;
      const rightExp = getPayloadWithoutVerification(right)?.exp ?? 0;
      return rightExp - leftExp;
    });
}

export async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;
  const candidateTokens = getCandidateSessionTokens(cookieStore.getAll());

  for (const token of candidateTokens) {
    const userId = await verifyClerkSessionToken(token, origin);
    if (userId) {
      return userId;
    }
  }

  return null;
}
