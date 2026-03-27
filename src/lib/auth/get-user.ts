import { verifyToken } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";

const DEFAULT_CLERK_JWT_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAscEBbmeStwgFwVIuLOFM
AilvmLmgM1u7sMK2C2IdqCpZTPsjgopihfvtUh1lMdVxbO/4XsHp0cqNZytRCPJ1
8qlz40OjFzGYCdbRIfy9g8bMLSKlrP3e3zVLTrYrY+jPJHOPD7CbjhmSU80WSsJW
Chg+wnZXjHV98xwSzLRi0tFD6PO2wggLlMUxRH4ub8/x39SJHw767amV82EQWB+T
APMFxviyGrGt75936wh1AxWRx1MP0p8BIZeQg5HDRctLpxlTl6N6QJ38BewIbcHp
66i/7oPSITJ3ff2Uipz4wjb4xsTL7F5sLCQiVId1VHj+Q8HV65YclfvBsAKH+YJH
wwIDAQAB
-----END PUBLIC KEY-----`;

function getAuthorizedParties(origin?: string) {
  const parties = new Set<string>();

  if (origin) {
    parties.add(origin);
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

  return parties.size > 0 ? [...parties] : undefined;
}

export async function verifyClerkSessionToken(
  token: string | undefined,
  origin?: string,
): Promise<string | null> {
  if (!token) {
    return null;
  }

  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      jwtKey: process.env.CLERK_JWT_KEY ?? DEFAULT_CLERK_JWT_KEY,
      authorizedParties: getAuthorizedParties(origin),
    });

    return typeof verified.sub === "string" ? verified.sub : null;
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;

  return verifyClerkSessionToken(cookieStore.get("__session")?.value, origin);
}
