import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { STRIPE_PRICES } from "@/lib/db/types";
import { resolveAppUrl } from "@/lib/url";

const PRICE_IDS = Object.fromEntries(
  Object.entries(STRIPE_PRICES).map(([plan, details]) => [plan, details.priceId])
) as Record<keyof typeof STRIPE_PRICES, string>;

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for upgrading to a plan.
 * Body: { plan: "starter" | "growth" | "enterprise" }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { plan } = body;

    if (!plan || !PRICE_IDS[plan as keyof typeof PRICE_IDS]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia" as const,
    });

    const appUrl = resolveAppUrl(request);

    // Create or retrieve Stripe customer
    let customerId = ctx.workspace.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { workspace_id: ctx.workspace.id },
      });
      customerId = customer.id;
      // Save customer ID to workspace
      await supabaseAdmin
        .from("workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.workspace.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[plan as keyof typeof PRICE_IDS], quantity: 1 }],
      success_url: `${appUrl}/settings?tab=billing&success=1`,
      cancel_url: `${appUrl}/settings?tab=billing`,
      metadata: { workspace_id: ctx.workspace.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing/checkout POST error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
