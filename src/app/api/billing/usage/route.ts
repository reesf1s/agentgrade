import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";
import { STRIPE_PRICES, PLAN_LIMITS } from "@/lib/db/types";

/**
 * GET /api/billing/usage
 * Returns current billing usage vs plan limits.
 *
 * Response:
 * {
 *   plan, limit, used_this_month, remaining, percent_used,
 *   billing_period: { start, end },
 *   stripe_subscription_id,
 *   price_info: { monthly_price_gbp, ... }
 * }
 */
export async function GET() {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = ctx.workspace.id;
    const plan = ctx.workspace.plan;

    // Count conversations ingested this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { count: usedThisMonth, error: countError } = await supabaseAdmin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString());

    if (countError) {
      return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
    }

    const limit = PLAN_LIMITS[plan] ?? 5000;
    const used = usedThisMonth || 0;
    const remaining = limit === -1 ? null : Math.max(0, limit - used);
    const percentUsed = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

    const priceInfo = STRIPE_PRICES[plan as keyof typeof STRIPE_PRICES] || null;

    // Count all-time scored conversations
    const { count: totalScored } = await supabaseAdmin
      .from("quality_scores")
      .select("id", { count: "exact", head: true })
      .in(
        "conversation_id",
        (await supabaseAdmin
          .from("conversations")
          .select("id")
          .eq("workspace_id", workspaceId)
          .then((r) => (r.data || []).map((c) => c.id)))
      );

    return NextResponse.json({
      plan,
      limit: limit === -1 ? null : limit,
      unlimited: limit === -1,
      used_this_month: used,
      remaining,
      percent_used: Math.round(percentUsed * 10) / 10,
      billing_period: {
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
      },
      stripe_customer_id: ctx.workspace.stripe_customer_id || null,
      stripe_subscription_id: ctx.workspace.stripe_subscription_id || null,
      price_info: priceInfo
        ? {
            monthly_price_gbp: priceInfo.amount,
            price_id: priceInfo.priceId,
            product_id: priceInfo.productId,
          }
        : null,
      all_time: {
        total_conversations: null, // would need a separate count
        total_scored: totalScored || 0,
      },
    });
  } catch (error) {
    console.error("Billing usage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
