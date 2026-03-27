import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { PLAN_LIMITS } from "@/lib/db/types";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
}

// Map Stripe price IDs to plan names
// These must match the prices in STRIPE_PRICES in types.ts
const PRICE_TO_PLAN: Record<string, string> = {
  price_1TFNL98v5Z7lw9xvEZtaAnuJ: "starter",   // £199/mo, 5000 convos
  price_1TFNLB8v5Z7lw9xvHUV1bd5y: "growth",    // £499/mo, 25000 convos
  price_1TFNLB8v5Z7lw9xvazyojuVr: "enterprise", // £999/mo, unlimited
};

/**
 * POST /api/webhooks/stripe
 * Handles Stripe subscription lifecycle events.
 *
 * Handled events:
 *   checkout.session.completed       → activate subscription, upgrade plan
 *   customer.subscription.updated    → plan change (upgrade/downgrade)
 *   customer.subscription.deleted    → cancel → downgrade to starter
 *   invoice.payment_failed           → log alert, notify workspace (future: email)
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  // Log all Stripe events to ag_webhook_events
  // Non-fatal: log event asynchronously
  void supabaseAdmin.from("ag_webhook_events").insert({
    event_source: "stripe",
    event_type: event.type,
    payload: { id: event.id },
    processed_at: new Date().toISOString(),
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        console.log(`Stripe event not handled: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err);
    // Return 200 to prevent Stripe from retrying — log the error instead
  }

  return NextResponse.json({ received: true });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspace_id;
  const plan = session.metadata?.plan;

  if (!workspaceId || !plan) {
    console.error("checkout.session.completed missing metadata:", session.id);
    return;
  }

  const limit = PLAN_LIMITS[plan] ?? 5000;

  await supabaseAdmin
    .from("ag_workspaces")
    .update({
      plan,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      monthly_conversation_limit: limit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  console.log(`Workspace ${workspaceId} upgraded to ${plan} plan via checkout ${session.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Look up workspace by Stripe customer ID
  const { data: workspace } = await supabaseAdmin
    .from("ag_workspaces")
    .select("id, plan")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!workspace) {
    console.error("No workspace found for Stripe customer:", customerId);
    return;
  }

  // Determine new plan from the subscription's price ID
  const priceId = subscription.items.data[0]?.price?.id;
  const newPlan = priceId ? PRICE_TO_PLAN[priceId] : null;

  if (!newPlan) {
    console.warn(`Unknown price ID in subscription update: ${priceId}`);
    return;
  }

  const limit = PLAN_LIMITS[newPlan] ?? 5000;

  await supabaseAdmin
    .from("ag_workspaces")
    .update({
      plan: newPlan,
      stripe_subscription_id: subscription.id,
      monthly_conversation_limit: limit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.id);

  console.log(`Workspace ${workspace.id} plan updated to ${newPlan} (was ${workspace.plan})`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const { data: workspace } = await supabaseAdmin
    .from("ag_workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!workspace) {
    console.error("No workspace found for Stripe customer:", customerId);
    return;
  }

  // Downgrade to starter (free tier equivalent)
  await supabaseAdmin
    .from("ag_workspaces")
    .update({
      plan: "starter",
      stripe_subscription_id: null,
      monthly_conversation_limit: PLAN_LIMITS.starter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspace.id);

  // Create an alert for the workspace
  await supabaseAdmin.from("ag_alerts").insert({
    workspace_id: workspace.id,
    alert_type: "subscription_cancelled",
    title: "Subscription cancelled",
    description: "Your AgentGrade subscription has been cancelled. You have been downgraded to the Starter plan (5,000 conversations/month).",
  });

  console.log(`Workspace ${workspace.id} downgraded to starter (subscription cancelled)`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: workspace } = await supabaseAdmin
    .from("ag_workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!workspace) {
    console.error("No workspace found for Stripe customer:", customerId);
    return;
  }

  // Create payment failure alert
  await supabaseAdmin.from("ag_alerts").insert({
    workspace_id: workspace.id,
    alert_type: "payment_failed",
    title: "Payment failed",
    description: `Payment of ${invoice.currency?.toUpperCase()} ${((invoice.amount_due || 0) / 100).toFixed(2)} failed. Please update your payment method to continue using AgentGrade.`,
  });

  console.log(`Payment failed for workspace ${workspace.id}, invoice ${invoice.id}`);
}
