import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getWorkspaceContext } from "@/lib/workspace";
import { resolveAppUrl } from "@/lib/url";

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!ctx.workspace.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found. Subscribe to a plan first." }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia" as const,
    });

    const appUrl = resolveAppUrl(request);

    const session = await stripe.billingPortal.sessions.create({
      customer: ctx.workspace.stripe_customer_id,
      return_url: `${appUrl}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing/portal POST error:", err);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
