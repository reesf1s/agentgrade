import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const secretKey = process.env.CLERK_SECRET_KEY || "";

  // Only activate Clerk middleware with production keys (pk_live_)
  // Development/test keys (pk_test_) cause MIDDLEWARE_INVOCATION_FAILED
  // on Vercel because the dev browser JWT flow isn't supported in production deployments
  const isProductionClerk =
    publishableKey.startsWith("pk_live_") && secretKey.startsWith("sk_live_");

  if (!isProductionClerk) {
    // No Clerk or test keys — let everything through (demo mode)
    return NextResponse.next();
  }

  // Production Clerk keys are set — this path is only reached with pk_live_ keys
  // For now, pass through. When user upgrades to production Clerk, we'll enable protection.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
