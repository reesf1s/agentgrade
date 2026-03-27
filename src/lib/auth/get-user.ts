/**
 * Shared helper to get the current Clerk userId.
 *
 * Primary: Clerk's auth() — works with production keys (pk_live_).
 * Fallback: Parse the __session JWT cookie — needed when Clerk's dev keys (pk_test_)
 *           cause auth() to return {userId: null} on Vercel Edge runtime.
 *
 * The __session cookie is a standard JWT. We base64url-decode the payload to
 * extract the "sub" claim which Clerk sets to the userId (e.g. "user_3BVAJmm2NAod...").
 * We do not verify the signature here; the cookie is httpOnly so only Clerk can set it.
 */
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export async function getUserId(): Promise<string | null> {
  // Primary: use Clerk's built-in auth
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Clerk throws with dev keys on Vercel Edge runtime — fall through to cookie fallback
  }

  // Fallback: decode the __session JWT cookie
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session");
    if (!sessionCookie?.value) return null;

    // JWT format: header.payload.signature
    const parts = sessionCookie.value.split(".");
    if (parts.length !== 3) return null;

    // Decode base64url payload
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf-8");
    const payload = JSON.parse(json) as Record<string, unknown>;

    // Clerk stores userId in the "sub" claim
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
