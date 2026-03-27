import { auth, verifyToken } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";

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
  if (!token || !process.env.CLERK_SECRET_KEY) {
    return null;
  }

  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: getAuthorizedParties(origin),
    });

    return typeof verified.sub === "string" ? verified.sub : null;
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) {
      return userId;
    }
  } catch {
    // Fall back to verifying the signed Clerk session token directly.
  }

  const cookieStore = await cookies();
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;

  return verifyClerkSessionToken(cookieStore.get("__session")?.value, origin);
}
