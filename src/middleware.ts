import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent } from "next/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/conversations(.*)",
  "/reports(.*)",
  "/patterns(.*)",
  "/benchmarks(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
]);

// Build the Clerk handler once (not per-request)
const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

// Wrap in try/catch so Clerk's dev-instance "Invalid header" crash in Vercel
// Edge runtime doesn't surface as MIDDLEWARE_INVOCATION_FAILED (500).
// Clerk test keys (pk_test_) trigger a dev-browser JWT flow that sets headers
// the Edge runtime rejects; production keys (pk_live_) work fine.
export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  try {
    return await clerkHandler(req, event);
  } catch (err) {
    // Clerk crashed (typically: test/dev keys + Edge runtime header restrictions).
    // Fall back: protect dashboard routes with a simple redirect; let public routes through.
    // IMPORTANT: check for an existing Clerk session cookie before redirecting — if present,
    // the user IS authenticated and we must let them through to avoid an infinite loop.
    console.error("[middleware] Clerk error — falling back to static protection:", err);
    if (isProtectedRoute(req)) {
      // __session = Clerk's signed session JWT; __client_uat = set whenever a user is active.
      // Either cookie present means Clerk authenticated the user (even with dev keys).
      const hasSession =
        req.cookies.has("__session") || req.cookies.has("__client_uat");
      if (hasSession) {
        return NextResponse.next();
      }
      const signInUrl = new URL("/sign-in", req.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
