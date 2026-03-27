import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { PLAN_LIMITS, STRIPE_PRICES } from "@/lib/db/types";

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-03-25.dahlia" as Stripe.LatestApiVersion,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspace_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (workspaceId) {
          let subscription: Stripe.Subscription | null = null;

          if (subscriptionId) {
            subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          }

          await syncWorkspaceSubscription({
            workspaceId,
            customerId,
            subscription,
            fallbackPlan: session.metadata?.plan || undefined,
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncWorkspaceSubscription({
          subscription,
          customerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncWorkspaceSubscription({
          subscription,
          customerId:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id,
          forcePlan: "starter",
        });
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceWithSubscription = invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;
        const workspaceId = await findWorkspaceId({
          customerId,
          subscriptionId:
            typeof invoiceWithSubscription.subscription === "string"
              ? invoiceWithSubscription.subscription
              : invoiceWithSubscription.subscription?.id,
        });

        if (workspaceId) {
          await supabaseAdmin.from("ag_alerts").insert({
            workspace_id: workspaceId,
            alert_type: "billing_payment_failed",
            title: "Subscription payment failed",
            description:
              "Stripe reported a failed payment. Billing should be reviewed to avoid an interruption in scoring.",
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }
}

async function syncWorkspaceSubscription(input: {
  workspaceId?: string;
  customerId?: string;
  subscription?: Stripe.Subscription | null;
  fallbackPlan?: string;
  forcePlan?: keyof typeof PLAN_LIMITS;
}) {
  const workspaceId =
    input.workspaceId ||
    (await findWorkspaceId({
      customerId: input.customerId,
      subscriptionId: input.subscription?.id,
    }));

  if (!workspaceId) {
    console.warn("[stripe] Could not resolve workspace for subscription event");
    return;
  }

  const resolvedPlan =
    input.forcePlan ||
    getPlanForPriceId(input.subscription?.items.data[0]?.price.id) ||
    getPlanFromString(input.fallbackPlan) ||
    "starter";

  const updates = {
    plan: resolvedPlan,
    stripe_customer_id: input.customerId || null,
    stripe_subscription_id: input.subscription?.status === "canceled" ? null : input.subscription?.id || null,
    monthly_conversation_limit: PLAN_LIMITS[resolvedPlan],
  };

  const { error } = await supabaseAdmin
    .from("ag_workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    console.error("[stripe] Failed to sync workspace subscription:", error);
  }
}

async function findWorkspaceId(input: {
  customerId?: string;
  subscriptionId?: string;
}): Promise<string | null> {
  if (input.subscriptionId) {
    const { data: bySubscription } = await supabaseAdmin
      .from("ag_workspaces")
      .select("id")
      .eq("stripe_subscription_id", input.subscriptionId)
      .maybeSingle();

    if (bySubscription?.id) {
      return bySubscription.id;
    }
  }

  if (input.customerId) {
    const { data: byCustomer } = await supabaseAdmin
      .from("ag_workspaces")
      .select("id")
      .eq("stripe_customer_id", input.customerId)
      .maybeSingle();

    if (byCustomer?.id) {
      return byCustomer.id;
    }
  }

  return null;
}

function getPlanForPriceId(priceId?: string | null): keyof typeof PLAN_LIMITS | null {
  if (!priceId) {
    return null;
  }

  const match = Object.entries(STRIPE_PRICES).find(([, details]) => details.priceId === priceId);
  return (match?.[0] as keyof typeof PLAN_LIMITS | undefined) ?? null;
}

function getPlanFromString(value?: string | null): keyof typeof PLAN_LIMITS | null {
  if (!value) {
    return null;
  }

  return value in PLAN_LIMITS ? (value as keyof typeof PLAN_LIMITS) : null;
}
