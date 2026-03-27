import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { verifyClerkSessionToken } from "@/lib/auth/get-user";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/conversations(.*)",
  "/reports(.*)",
  "/patterns(.*)",
  "/benchmarks(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isProtectedRoute(req)) {
    return;
  }

  try {
    const authState = await auth();
    if (authState.userId) {
      return NextResponse.next();
    }
  } catch {
    // Fall back to direct session-token verification below.
  }

  const fallbackUserId = await verifyClerkSessionToken(
    req.cookies.get("__session")?.value,
    req.nextUrl.origin,
  );

  if (fallbackUserId) {
    return NextResponse.next();
  }

  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("redirect_url", req.url);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
