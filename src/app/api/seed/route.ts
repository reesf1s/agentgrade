import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

interface DemoConversation {
  customer: string;
  score: number;
  accuracy: number;
  hallucination: number;
  resolution: number;
  tone: number;
  summary: string;
  flags: string[];
}

// Only allow in non-production or for specific flag
export async function POST() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if workspace already has conversations
  const { count } = await supabaseAdmin
    .from("ag_conversations")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id);

  if (count && count > 0) {
    return NextResponse.json({ message: "Already has data", count });
  }

  // Create a demo connection
  const { data: connection } = await supabaseAdmin
    .from("ag_agent_connections")
    .insert({
      workspace_id: ctx.workspace.id,
      platform: "custom",
      name: "Demo Agent",
      is_active: true,
    })
    .select("id")
    .single();

  if (!connection) return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });

  // Seed 20 demo conversations with varied quality scores
  const demoConversations: DemoConversation[] = [
    { customer: "alice@example.com", score: 0.92, accuracy: 0.95, hallucination: 0.88, resolution: 0.94, tone: 0.91, summary: "Agent resolved refund request quickly and accurately", flags: [] },
    { customer: "bob@techcorp.com", score: 0.41, accuracy: 0.35, hallucination: 0.28, resolution: 0.52, tone: 0.70, summary: "Agent provided outdated pricing information and failed to resolve", flags: ["ungrounded_claim", "pricing_error"] },
    { customer: "carol@startup.io", score: 0.78, accuracy: 0.82, hallucination: 0.75, resolution: 0.76, tone: 0.85, summary: "Good resolution but minor accuracy gaps in product details", flags: ["verify_details"] },
    { customer: "david@enterprise.com", score: 0.25, accuracy: 0.18, hallucination: 0.15, resolution: 0.35, tone: 0.55, summary: "Multiple hallucinated facts about features, escalated to human", flags: ["hallucination", "escalation_triggered", "ungrounded_claim"] },
    { customer: "emma@shop.co", score: 0.88, accuracy: 0.90, hallucination: 0.86, resolution: 0.89, tone: 0.92, summary: "Correctly handled order status inquiry with accurate tracking", flags: [] },
    { customer: "frank@agency.net", score: 0.55, accuracy: 0.58, hallucination: 0.48, resolution: 0.60, tone: 0.72, summary: "Partial resolution, agent suggested wrong workaround", flags: ["resolution_weak"] },
    { customer: "grace@company.org", score: 0.95, accuracy: 0.97, hallucination: 0.94, resolution: 0.96, tone: 0.95, summary: "Excellent handling of technical question with verified sources", flags: [] },
    { customer: "henry@firm.com", score: 0.33, accuracy: 0.28, hallucination: 0.22, resolution: 0.42, tone: 0.60, summary: "Fabricated feature capabilities, customer ended frustrated", flags: ["hallucination", "tone_poor", "resolution_failed"] },
    { customer: "isabel@brand.co", score: 0.71, accuracy: 0.74, hallucination: 0.68, resolution: 0.72, tone: 0.78, summary: "Adequate answer but missed key context from previous interaction", flags: ["context_gap"] },
    { customer: "jack@dev.io", score: 0.84, accuracy: 0.88, hallucination: 0.82, resolution: 0.85, tone: 0.87, summary: "Clear and helpful response with correct API documentation cited", flags: [] },
    { customer: "kate@retail.com", score: 0.48, accuracy: 0.42, hallucination: 0.38, resolution: 0.55, tone: 0.68, summary: "Wrong return policy cited, customer had to be transferred", flags: ["policy_error", "escalation_triggered"] },
    { customer: "liam@media.tv", score: 0.91, accuracy: 0.93, hallucination: 0.90, resolution: 0.92, tone: 0.94, summary: "Proactive and accurate billing resolution", flags: [] },
    { customer: "mia@health.care", score: 0.62, accuracy: 0.65, hallucination: 0.55, resolution: 0.66, tone: 0.80, summary: "Some uncertainty in answers, needed follow-up clarification", flags: ["uncertain_claim"] },
    { customer: "noah@finance.biz", score: 0.38, accuracy: 0.30, hallucination: 0.25, resolution: 0.48, tone: 0.65, summary: "Incorrect compliance information provided, high risk", flags: ["compliance_risk", "ungrounded_claim", "escalation_triggered"] },
    { customer: "olivia@edu.org", score: 0.87, accuracy: 0.89, hallucination: 0.86, resolution: 0.88, tone: 0.90, summary: "Correctly guided user through onboarding process", flags: [] },
    { customer: "peter@logistics.net", score: 0.44, accuracy: 0.40, hallucination: 0.35, resolution: 0.50, tone: 0.70, summary: "Shipping estimate was wrong by 3 days, partial escalation", flags: ["date_error", "resolution_weak"] },
    { customer: "quinn@studio.co", score: 0.79, accuracy: 0.82, hallucination: 0.77, resolution: 0.80, tone: 0.83, summary: "Good technical support, resolved most issues", flags: [] },
    { customer: "rachel@sports.com", score: 0.29, accuracy: 0.22, hallucination: 0.18, resolution: 0.38, tone: 0.58, summary: "Repeated wrong product specifications three times", flags: ["hallucination", "repetitive_error", "escalation_triggered"] },
    { customer: "sam@saas.io", score: 0.85, accuracy: 0.87, hallucination: 0.84, resolution: 0.86, tone: 0.88, summary: "Accurate subscription management guidance", flags: [] },
    { customer: "tara@consulting.com", score: 0.67, accuracy: 0.70, hallucination: 0.62, resolution: 0.68, tone: 0.75, summary: "Mostly correct but lacked depth in technical explanation", flags: ["verify_details"] },
  ];

  const now = new Date();
  const conversationsToInsert = demoConversations.map((demo, i) => ({
    workspace_id: ctx.workspace.id,
    connection_id: connection.id,
    customer_identifier: demo.customer,
    platform: "custom",
    message_count: Math.floor(Math.random() * 8) + 3,
    was_escalated: demo.flags.some((f) => f.includes("escalation")),
    created_at: new Date(now.getTime() - i * 6 * 60 * 60 * 1000).toISOString(), // spread over past few days
  }));

  const { data: conversations, error: convError } = await supabaseAdmin
    .from("ag_conversations")
    .insert(conversationsToInsert)
    .select("id");

  if (convError || !conversations) {
    return NextResponse.json({ error: "Failed to create conversations" }, { status: 500 });
  }

  // Seed quality scores
  const scoresToInsert = conversations.map((conv, i) => {
    const demo = demoConversations[i]!;
    return {
      conversation_id: conv.id,
      workspace_id: ctx.workspace.id,
      overall_score: demo.score,
      accuracy_score: demo.accuracy,
      hallucination_score: demo.hallucination,
      resolution_score: demo.resolution,
      tone_score: demo.tone,
      summary: demo.summary,
      flags: demo.flags,
      confidence_level: demo.score > 0.7 ? "high" : demo.score > 0.4 ? "medium" : "low",
      prompt_improvements:
        demo.score < 0.65
          ? ["Be more specific about product limitations", "Always cite sources for pricing"]
          : [],
    };
  });

  await supabaseAdmin.from("ag_quality_scores").insert(scoresToInsert);

  // Seed failure patterns
  await supabaseAdmin.from("ag_failure_patterns").insert([
    {
      workspace_id: ctx.workspace.id,
      title: "Hallucinated product features",
      description:
        "Agent confidently states feature capabilities that don't exist in the product. Occurs most frequently when customers ask about integrations.",
      severity: "high",
      affected_conversation_ids: conversations
        .filter((_, i) => demoConversations[i]!.flags.includes("hallucination"))
        .map((c) => c.id),
      recommendation:
        "Add a tool that queries the live product documentation before answering feature questions.",
      workflow_state: "new",
    },
    {
      workspace_id: ctx.workspace.id,
      title: "Incorrect pricing and policy citations",
      description:
        "Agent references outdated pricing tiers and return policies. Three separate conversations affected this week.",
      severity: "medium",
      affected_conversation_ids: conversations
        .filter((_, i) =>
          demoConversations[i]!.flags.some(
            (f) => f.includes("policy") || f.includes("pricing")
          )
        )
        .map((c) => c.id),
      recommendation:
        "Update the knowledge base with current pricing. Consider a pricing lookup tool.",
      workflow_state: "new",
    },
    {
      workspace_id: ctx.workspace.id,
      title: "Escalation without resolution attempt",
      description:
        "Agent escalates to human without first attempting structured resolution steps. Increasing agent handoff rate.",
      severity: "medium",
      affected_conversation_ids: conversations
        .filter((_, i) =>
          demoConversations[i]!.flags.includes("escalation_triggered")
        )
        .map((c) => c.id)
        .slice(0, 4),
      recommendation:
        "Add escalation guard: require agent to attempt 2 resolution steps before escalating.",
      workflow_state: "monitoring",
    },
  ]);

  return NextResponse.json({
    success: true,
    conversations_seeded: conversations.length,
    workspace_id: ctx.workspace.id,
  });
}
