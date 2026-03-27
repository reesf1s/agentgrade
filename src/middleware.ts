import { NextRequest, NextResponse } from "next/server";
import { getCandidateSessionTokens, verifyClerkSessionToken } from "@/lib/auth/get-user";

const PROTECTED_PATHS = [
  "/dashboard",
  "/conversations",
  "/reports",
  "/patterns",
  "/benchmarks",
  "/settings",
  "/onboarding",
];

function isProtectedRoute(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default async function middleware(req: NextRequest) {
  if (!isProtectedRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const candidateTokens = getCandidateSessionTokens(req.cookies.getAll());

  for (const token of candidateTokens) {
    const fallbackUserId = await verifyClerkSessionToken(token, req.nextUrl.origin);
    if (fallbackUserId) {
      return NextResponse.next();
    }
  }

  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("redirect_url", req.url);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
