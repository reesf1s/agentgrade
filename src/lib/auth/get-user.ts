/**
 * Auth helper that works with both Clerk production keys and dev keys.
 * With dev keys on Vercel, Clerk's auth() returns null even for signed-in users.
 * Falls back to reading __session cookie and decoding the JWT payload.
 */
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export interface AuthUser {
  userId: string;
}

/**
 * Get the authenticated user ID. Tries Clerk auth() first, then falls back
 * to JWT cookie decoding for environments where Clerk dev keys return null.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  // Try Clerk's auth() first (works with production keys)
  try {
    const { userId } = await auth();
    if (userId) return { userId };
  } catch {
    // auth() may throw in some edge cases
  }

  // Fall back to __session cookie (JWT) for Clerk dev keys
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) return null;

    // JWT is three base64url parts: header.payload.signature
    const parts = sessionCookie.split(".");
    if (parts.length < 2) return null;

    // Base64url decode the payload
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "==".slice(0, (4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));

    const userId = decoded?.sub as string | undefined;
    if (userId) return { userId };
  } catch {
    // JWT decode failed
  }

  return null;
}
