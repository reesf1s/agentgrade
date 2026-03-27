import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import Stripe from "stripe";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
}

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so users can manage their subscription,
 * update payment methods, view invoices, and cancel.
 *
 * Returns: { portal_url: string }
 */
export async function POST() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["owner"].includes(ctx.member.role)) {
      return NextResponse.json({ error: "Only the workspace owner can access billing settings" }, { status: 403 });
    }

    if (!ctx.workspace.stripe_customer_id) {
      return NextResponse.json(
        { error: "No active subscription found. Start a subscription first via /api/billing/checkout." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: ctx.workspace.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    // Update last_sync_at on the workspace as a billing-touched marker
    await supabaseAdmin
      .from("ag_workspaces")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", ctx.workspace.id);

    return NextResponse.json({ portal_url: portalSession.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
