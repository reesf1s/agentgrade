import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { STRIPE_PRICES, PLAN_LIMITS } from "@/lib/db/types";

const PLAN_PRICES: Record<string, string> = {
  starter: `£${STRIPE_PRICES.starter.amount}/mo`,
  growth: `£${STRIPE_PRICES.growth.amount}/mo`,
  enterprise: `£${STRIPE_PRICES.enterprise.amount}/mo`,
};

/**
 * GET /api/billing
 * Returns current plan, usage this month, and subscription status.
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workspace } = ctx;

    // Count conversations scored this billing month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .gte("created_at", monthStart.toISOString());

    const plan = workspace.plan ?? "starter";
    const rawLimit = PLAN_LIMITS[plan] ?? 5000;
    const isUnlimited = rawLimit <= 0;

    return NextResponse.json({
      plan,
      price: PLAN_PRICES[plan] ?? "£199/mo",
      usage: count ?? 0,
      limit: isUnlimited ? null : rawLimit,
      configured: !!process.env.STRIPE_SECRET_KEY,
      stripe_customer_id: workspace.stripe_customer_id,
      stripe_subscription_id: workspace.stripe_subscription_id,
    });
  } catch (err) {
    console.error("billing GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
