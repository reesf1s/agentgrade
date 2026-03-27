import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

const PLAN_LIMITS = {
  starter: 5000,
  growth: 25000,
  enterprise: Infinity,
};

const PLAN_PRICES = {
  starter: "£199/mo",
  growth: "£499/mo",
  enterprise: "Custom",
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
    const limit = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? 5000;

    return NextResponse.json({
      plan,
      price: PLAN_PRICES[plan as keyof typeof PLAN_PRICES] ?? "£199/mo",
      usage: count ?? 0,
      limit: limit === Infinity ? null : limit,
      configured: !!process.env.STRIPE_SECRET_KEY,
      stripe_customer_id: workspace.stripe_customer_id,
      stripe_subscription_id: workspace.stripe_subscription_id,
    });
  } catch (err) {
    console.error("billing GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
