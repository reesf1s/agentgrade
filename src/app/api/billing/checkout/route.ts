import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import Stripe from "stripe";
import { STRIPE_PRICES } from "@/lib/db/types";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
}

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for a plan upgrade.
 *
 * Body: { plan: 'starter'|'growth'|'enterprise' }
 * Returns: { checkout_url: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only the workspace owner can manage billing" }, { status: 403 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !["starter", "growth", "enterprise"].includes(plan)) {
      return NextResponse.json(
        { error: "plan must be one of: starter, growth, enterprise" },
        { status: 400 }
      );
    }

    const priceConfig = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES];
    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com";

    // Create or retrieve Stripe customer
    let customerId = ctx.workspace.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          workspace_id: ctx.workspace.id,
          workspace_slug: ctx.workspace.slug,
        },
      });
      customerId = customer.id;

      // Store customer ID
      await supabaseAdmin
        .from("ag_workspaces")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.workspace.id);
    }

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceConfig.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${appUrl}/settings?billing=success&plan=${plan}`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      metadata: {
        workspace_id: ctx.workspace.id,
        plan,
      },
      subscription_data: {
        metadata: {
          workspace_id: ctx.workspace.id,
          plan,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      currency: priceConfig.currency,
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    console.error("Billing checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
