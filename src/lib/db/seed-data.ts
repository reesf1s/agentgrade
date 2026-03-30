/**
 * Seed data for demo purposes.
 * Generates realistic conversations, scores, and patterns.
 */

import type { Conversation, Message, QualityScore, FailurePattern, Alert, WeeklyReportSummary } from "./types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function minutesAfter(base: string, mins: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

// ─── Sample Conversations ──────────────────────────────────────────
export const SEED_CONVERSATIONS: (Conversation & { messages: Message[]; quality_score: QualityScore })[] = [
  {
    id: "conv-001",
    workspace_id: "ws-demo",
    platform: "intercom",
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    message_count: 6,
    was_escalated: false,
    customer_identifier: "sarah@techcorp.com",
    metadata: {},
    created_at: daysAgo(1),
    messages: [
      { id: "m1", conversation_id: "conv-001", role: "customer", content: "Hi, I need to upgrade my plan from Starter to Growth. How do I do that?", timestamp: daysAgo(1), metadata: {} },
      { id: "m2", conversation_id: "conv-001", role: "agent", content: "Hi Sarah! I'd be happy to help you upgrade. You can upgrade your plan by going to Settings > Billing > Change Plan. The Growth plan is $49/month and includes advanced analytics, priority support, and up to 50 team members.", timestamp: minutesAfter(daysAgo(1), 1), metadata: {} },
      { id: "m3", conversation_id: "conv-001", role: "customer", content: "Great, will I lose any of my current data when upgrading?", timestamp: minutesAfter(daysAgo(1), 2), metadata: {} },
      { id: "m4", conversation_id: "conv-001", role: "agent", content: "No, absolutely not! All your data, settings, and configurations will be preserved when you upgrade. The upgrade is seamless — you'll just get access to the additional features immediately.", timestamp: minutesAfter(daysAgo(1), 3), metadata: {} },
      { id: "m5", conversation_id: "conv-001", role: "customer", content: "Perfect, just upgraded. Thanks for the help!", timestamp: minutesAfter(daysAgo(1), 5), metadata: {} },
      { id: "m6", conversation_id: "conv-001", role: "agent", content: "Wonderful! Welcome to the Growth plan, Sarah. If you have any questions about the new features, don't hesitate to reach out. Have a great day!", timestamp: minutesAfter(daysAgo(1), 6), metadata: {} },
    ],
    quality_score: {
      id: "qs-001", conversation_id: "conv-001", overall_score: 0.92,
      accuracy_score: 0.95, hallucination_score: 0.95, resolution_score: 0.95,
      tone_score: 0.90, sentiment_score: 0.88,
      structural_metrics: { turn_count: 6, agent_turns: 3, customer_turns: 3, avg_agent_response_length: 180, avg_customer_message_length: 60, repetition_count: 0, conversation_type: "billing", extracted_claims: ["Growth plan is $49/month", "includes advanced analytics", "up to 50 team members", "data preserved when upgrading"], sentiment_per_turn: [] },
      claim_analysis: [
        { claim: "Growth plan is $49/month", verdict: "verified", evidence: "Matches pricing page" },
        { claim: "includes advanced analytics, priority support, and up to 50 team members", verdict: "verified", evidence: "Matches feature comparison" },
        { claim: "All data preserved when upgrading", verdict: "verified", evidence: "Standard upgrade behavior" },
      ],
      flags: [], summary: "Excellent interaction. Agent accurately described the upgrade process and features. Customer left satisfied.",
      prompt_improvements: [], knowledge_gaps: [],
      scoring_model_version: "v1", scored_at: daysAgo(1),
    },
  },
  {
    id: "conv-002",
    workspace_id: "ws-demo",
    platform: "intercom",
    started_at: daysAgo(2),
    ended_at: daysAgo(2),
    message_count: 8,
    was_escalated: true,
    customer_identifier: "mike@startup.io",
    metadata: {},
    created_at: daysAgo(2),
    messages: [
      { id: "m7", conversation_id: "conv-002", role: "customer", content: "I've been charged twice for my subscription this month. Can you fix this?", timestamp: daysAgo(2), metadata: {} },
      { id: "m8", conversation_id: "conv-002", role: "agent", content: "I understand you're concerned about the double charge. Our refund policy allows for full refunds within 30 days of the charge. I can see your account and confirm there was a duplicate transaction.", timestamp: minutesAfter(daysAgo(2), 1), metadata: {} },
      { id: "m9", conversation_id: "conv-002", role: "customer", content: "OK so can you process the refund?", timestamp: minutesAfter(daysAgo(2), 3), metadata: {} },
      { id: "m10", conversation_id: "conv-002", role: "agent", content: "I'd be happy to help with that! The refund will be processed within 5-7 business days and you'll see it reflected in your bank account. I've initiated the refund for $29.99.", timestamp: minutesAfter(daysAgo(2), 4), metadata: {} },
      { id: "m11", conversation_id: "conv-002", role: "customer", content: "Wait, the charge was $49.99 not $29.99. You're refunding the wrong amount!", timestamp: minutesAfter(daysAgo(2), 5), metadata: {} },
      { id: "m12", conversation_id: "conv-002", role: "agent", content: "I apologize for the confusion. Let me correct that — I'll process the refund for the full $49.99. You're on the Growth plan which is $49.99/month.", timestamp: minutesAfter(daysAgo(2), 6), metadata: {} },
      { id: "m13", conversation_id: "conv-002", role: "customer", content: "This is frustrating. Can I speak to a human agent please?", timestamp: minutesAfter(daysAgo(2), 8), metadata: {} },
      { id: "m14", conversation_id: "conv-002", role: "agent", content: "I completely understand, Mike. Let me connect you with a human agent right away who can verify the refund has been processed correctly. One moment please.", timestamp: minutesAfter(daysAgo(2), 9), metadata: {} },
    ],
    quality_score: {
      id: "qs-002", conversation_id: "conv-002", overall_score: 0.45,
      accuracy_score: 0.40, hallucination_score: 0.50, resolution_score: 0.30,
      tone_score: 0.75, sentiment_score: 0.25,
      structural_metrics: { turn_count: 8, agent_turns: 4, customer_turns: 4, avg_agent_response_length: 200, avg_customer_message_length: 65, escalation_turn: 6, repetition_count: 0, conversation_type: "billing", extracted_claims: ["refund policy allows full refunds within 30 days", "refund processed within 5-7 business days", "refund for $29.99"], sentiment_per_turn: [] },
      claim_analysis: [
        { claim: "refund policy allows full refunds within 30 days", verdict: "verified", evidence: "Matches refund policy" },
        { claim: "refund processed within 5-7 business days", verdict: "verified", evidence: "Standard processing time" },
        { claim: "refund for $29.99", verdict: "contradicted", evidence: "Customer is on Growth plan at $49.99/month" },
      ],
      flags: ["incorrect_amount", "escalation_triggered", "data_lookup_error"],
      summary: "Agent quoted wrong refund amount ($29.99 vs $49.99), causing frustration and escalation. The refund policy knowledge was correct but account data was misread.",
      prompt_improvements: [
        { issue: "Agent quoted incorrect refund amount", current_behavior: "Agent stated $29.99 when the actual charge was $49.99", recommended_prompt_change: "Add to system prompt: 'When discussing specific amounts, always verify the exact charge from the customer's transaction history before quoting. Never assume or round amounts.'", expected_impact: "Prevents incorrect amount quotes that erode trust", priority: "high" },
        { issue: "Agent didn't verify amount before committing to action", current_behavior: "Immediately offered a refund without confirming the amount", recommended_prompt_change: "Add to system prompt: 'Before processing any financial action, confirm the exact amount with the customer: \"I can see a charge of [amount]. Can you confirm this is the one you'd like refunded?\"'", expected_impact: "Catches errors before they cause frustration", priority: "high" },
      ],
      knowledge_gaps: [],
      scoring_model_version: "v1", scored_at: daysAgo(2),
    },
  },
  {
    id: "conv-003",
    workspace_id: "ws-demo",
    platform: "intercom",
    started_at: daysAgo(3),
    ended_at: daysAgo(3),
    message_count: 4,
    was_escalated: false,
    customer_identifier: "anna@designco.com",
    metadata: {},
    created_at: daysAgo(3),
    messages: [
      { id: "m15", conversation_id: "conv-003", role: "customer", content: "Does your platform integrate with Figma?", timestamp: daysAgo(3), metadata: {} },
      { id: "m16", conversation_id: "conv-003", role: "agent", content: "Yes! We have a native Figma integration that allows you to import designs directly into your workspace. You can find it in Settings > Integrations > Figma. It supports both Figma files and FigJam boards.", timestamp: minutesAfter(daysAgo(3), 1), metadata: {} },
      { id: "m17", conversation_id: "conv-003", role: "customer", content: "I don't see a Figma option in my integrations page. Are you sure this exists?", timestamp: minutesAfter(daysAgo(3), 3), metadata: {} },
      { id: "m18", conversation_id: "conv-003", role: "agent", content: "I apologize for the confusion. You're right — I need to correct myself. We don't currently have a native Figma integration, but it's on our roadmap. I can add you to our waiting list to be notified when it launches. In the meantime, you can export from Figma as PNG/SVG and import those files directly.", timestamp: minutesAfter(daysAgo(3), 4), metadata: {} },
    ],
    quality_score: {
      id: "qs-003", conversation_id: "conv-003", overall_score: 0.38,
      accuracy_score: 0.20, hallucination_score: 0.15, resolution_score: 0.50,
      tone_score: 0.85, sentiment_score: 0.40,
      structural_metrics: { turn_count: 4, agent_turns: 2, customer_turns: 2, avg_agent_response_length: 220, avg_customer_message_length: 55, repetition_count: 0, conversation_type: "technical", extracted_claims: ["native Figma integration", "supports Figma files and FigJam boards", "Settings > Integrations > Figma"], sentiment_per_turn: [] },
      claim_analysis: [
        { claim: "native Figma integration", verdict: "fabricated", evidence: "No Figma integration exists" },
        { claim: "supports Figma files and FigJam boards", verdict: "fabricated", evidence: "Feature doesn't exist" },
        { claim: "Settings > Integrations > Figma", verdict: "fabricated", evidence: "No such menu item" },
      ],
      flags: ["hallucination:integration", "fabricated_feature", "customer_misled"],
      summary: "Agent fabricated a Figma integration that doesn't exist, including specific navigation steps. Self-corrected after customer pushed back, but damage was done.",
      prompt_improvements: [
        { issue: "Agent fabricated a non-existent integration", current_behavior: "Confidently described a Figma integration with specific details", recommended_prompt_change: "Add to system prompt: 'Our current integrations are: [list actual integrations]. If a customer asks about an integration not on this list, say \"We don't currently have a [X] integration, but I can check if it's on our roadmap.\" NEVER describe features that don't exist.'", expected_impact: "Eliminates hallucinated features — the most damaging type of error", priority: "high" },
      ],
      knowledge_gaps: [
        { topic: "integrations", description: "Agent doesn't have an accurate list of available integrations", affected_conversations: 1, suggested_content: "Add a document listing all current integrations with their setup instructions and limitations" },
      ],
      scoring_model_version: "v1", scored_at: daysAgo(3),
    },
  },
  {
    id: "conv-004",
    workspace_id: "ws-demo",
    platform: "custom",
    started_at: daysAgo(1),
    ended_at: daysAgo(1),
    message_count: 6,
    was_escalated: false,
    customer_identifier: "james@corp.com",
    metadata: {},
    created_at: daysAgo(1),
    messages: [
      { id: "m19", conversation_id: "conv-004", role: "customer", content: "How do I export my data as CSV?", timestamp: daysAgo(1), metadata: {} },
      { id: "m20", conversation_id: "conv-004", role: "agent", content: "You can export your data by going to the Reports section and clicking the Export button in the top right corner. From there, select CSV format and choose the date range you want.", timestamp: minutesAfter(daysAgo(1), 1), metadata: {} },
      { id: "m21", conversation_id: "conv-004", role: "customer", content: "Found it, thanks. One more question — can I schedule automatic exports?", timestamp: minutesAfter(daysAgo(1), 3), metadata: {} },
      { id: "m22", conversation_id: "conv-004", role: "agent", content: "Yes! Scheduled exports are available on the Growth and Enterprise plans. Go to Reports > Scheduled Exports > Create New. You can set them to run daily, weekly, or monthly, and they'll be emailed to any address you specify.", timestamp: minutesAfter(daysAgo(1), 4), metadata: {} },
      { id: "m23", conversation_id: "conv-004", role: "customer", content: "That's exactly what I need. Thanks!", timestamp: minutesAfter(daysAgo(1), 6), metadata: {} },
      { id: "m24", conversation_id: "conv-004", role: "agent", content: "You're welcome, James! Happy exporting. Let me know if you need anything else.", timestamp: minutesAfter(daysAgo(1), 7), metadata: {} },
    ],
    quality_score: {
      id: "qs-004", conversation_id: "conv-004", overall_score: 0.88,
      accuracy_score: 0.90, hallucination_score: 0.95, resolution_score: 0.90,
      tone_score: 0.85, sentiment_score: 0.90,
      structural_metrics: { turn_count: 6, agent_turns: 3, customer_turns: 3, avg_agent_response_length: 165, avg_customer_message_length: 50, repetition_count: 0, conversation_type: "technical", extracted_claims: ["Export button in Reports section", "CSV format available", "Scheduled exports on Growth and Enterprise"], sentiment_per_turn: [] },
      claim_analysis: [
        { claim: "Export button in Reports section top right", verdict: "verified", evidence: "Matches UI" },
        { claim: "Scheduled exports on Growth and Enterprise", verdict: "verified", evidence: "Matches plan features" },
      ],
      flags: [],
      summary: "Clean, accurate interaction. Agent provided step-by-step guidance and correctly described feature availability per plan.",
      prompt_improvements: [], knowledge_gaps: [],
      scoring_model_version: "v1", scored_at: daysAgo(1),
    },
  },
  {
    id: "conv-005",
    workspace_id: "ws-demo",
    platform: "intercom",
    started_at: daysAgo(4),
    ended_at: daysAgo(4),
    message_count: 6,
    was_escalated: false,
    customer_identifier: "lisa@retail.com",
    metadata: {},
    created_at: daysAgo(4),
    messages: [
      { id: "m25", conversation_id: "conv-005", role: "customer", content: "I want to cancel my subscription.", timestamp: daysAgo(4), metadata: {} },
      { id: "m26", conversation_id: "conv-005", role: "agent", content: "I'm sorry to hear you'd like to cancel. Before I process that, could you share what's prompting this decision? I want to make sure there isn't something we can help with.", timestamp: minutesAfter(daysAgo(4), 1), metadata: {} },
      { id: "m27", conversation_id: "conv-005", role: "customer", content: "We're cutting costs and don't use the platform enough to justify the price.", timestamp: minutesAfter(daysAgo(4), 3), metadata: {} },
      { id: "m28", conversation_id: "conv-005", role: "agent", content: "I understand. Just so you know, we do have a Starter plan at $19/month that includes the core features. That might work if you still want access without the full cost. But if you'd like to proceed with cancellation, I can handle that for you right now.", timestamp: minutesAfter(daysAgo(4), 4), metadata: {} },
      { id: "m29", conversation_id: "conv-005", role: "customer", content: "Actually the $19 plan might work. Can you switch me to that instead?", timestamp: minutesAfter(daysAgo(4), 6), metadata: {} },
      { id: "m30", conversation_id: "conv-005", role: "agent", content: "Absolutely! I've downgraded your account to the Starter plan. You'll be billed $19/month starting next cycle. All your data is preserved. You can always upgrade again anytime from Settings > Billing.", timestamp: minutesAfter(daysAgo(4), 7), metadata: {} },
    ],
    quality_score: {
      id: "qs-005", conversation_id: "conv-005", overall_score: 0.94,
      accuracy_score: 0.92, hallucination_score: 1.0, resolution_score: 0.95,
      tone_score: 0.95, sentiment_score: 0.92,
      structural_metrics: { turn_count: 6, agent_turns: 3, customer_turns: 3, avg_agent_response_length: 190, avg_customer_message_length: 55, repetition_count: 0, conversation_type: "billing", extracted_claims: ["Starter plan at $19/month", "data is preserved on downgrade"], sentiment_per_turn: [] },
      claim_analysis: [
        { claim: "Starter plan at $19/month", verdict: "verified" },
        { claim: "data preserved on downgrade", verdict: "verified" },
      ],
      flags: [],
      summary: "Outstanding retention conversation. Agent empathetically explored the reason for cancellation and offered a relevant alternative, saving the customer.",
      prompt_improvements: [], knowledge_gaps: [],
      scoring_model_version: "v1", scored_at: daysAgo(4),
    },
  },
];

// ─── Seed Failure Patterns ─────────────────────────────────────────
export const SEED_PATTERNS: FailurePattern[] = [
  {
    id: "fp-001", workspace_id: "ws-demo",
    pattern_type: "hallucination_cluster",
    title: "Integration hallucinations: agent fabricating features",
    description: "3 conversations this week where the agent described integrations that don't exist. Customers were told about Figma, Notion, and Asana integrations that aren't available.",
    affected_conversation_ids: ["conv-003"],
    severity: "critical",
    recommendation: "Update the agent's system prompt with an exhaustive list of actual integrations.",
    prompt_fix: "Add to system prompt: 'Our current integrations are: Slack, Google Workspace, Jira, GitHub, and Zapier. If asked about any other integration, say: \"We don't currently offer a [name] integration, but I can check our roadmap for you.\"'",
    knowledge_base_suggestion: "Create a document listing all integrations with setup instructions",
    workflow_state: "actioning",
    workflow_updated_at: daysAgo(1),
    detected_at: daysAgo(1), is_resolved: false,
  },
  {
    id: "fp-002", workspace_id: "ws-demo",
    pattern_type: "topic_cluster",
    title: "Refund amount errors in billing conversations",
    description: "2 conversations where the agent quoted incorrect refund amounts. The agent appears to pull amounts from the wrong field or defaults to a standard amount instead of looking up the actual charge.",
    affected_conversation_ids: ["conv-002"],
    severity: "high",
    recommendation: "Add amount verification step to the agent's billing conversation flow.",
    prompt_fix: "Add to system prompt: 'For any billing-related action (refund, credit, adjustment), ALWAYS confirm the exact amount with the customer before proceeding. Say: \"I can see a charge of $[exact amount] on [date]. Is this the charge you're referring to?\"'",
    knowledge_base_suggestion: undefined,
    workflow_state: "monitoring",
    workflow_updated_at: daysAgo(1),
    detected_at: daysAgo(1), is_resolved: false,
  },
  {
    id: "fp-003", workspace_id: "ws-demo",
    pattern_type: "escalation_trigger",
    title: "Early escalation after billing errors",
    description: "Customers who encounter billing errors are requesting human agents within 2-3 messages. The pattern suggests that a single wrong answer about money immediately destroys trust.",
    affected_conversation_ids: ["conv-002"],
    severity: "medium",
    recommendation: "Prioritize accuracy over speed for billing conversations. Add a verification step.",
    prompt_fix: "Add to system prompt: 'For billing inquiries, take extra care to verify amounts before responding. A wrong number about money will immediately lose the customer's trust.'",
    knowledge_base_suggestion: undefined,
    workflow_state: "new",
    workflow_updated_at: daysAgo(2),
    detected_at: daysAgo(2), is_resolved: false,
  },
];

// ─── Seed Alerts ───────────────────────────────────────────────────
export const SEED_ALERTS: Alert[] = [
  {
    id: "alert-001", workspace_id: "ws-demo",
    alert_type: "hallucination_spike",
    title: "Hallucination rate above threshold",
    description: "3 hallucination incidents detected in the last 24 hours, exceeding the threshold of 1.",
    threshold_value: 0.7, actual_value: 0.45,
    triggered_at: daysAgo(0),
  },
  {
    id: "alert-002", workspace_id: "ws-demo",
    alert_type: "quality_drop",
    title: "Overall quality dropped 12% this week",
    description: "Average quality score dropped from 0.78 to 0.66 compared to last week.",
    threshold_value: 0.7, actual_value: 0.66,
    triggered_at: daysAgo(1),
  },
];

// ─── Seed Weekly Report ────────────────────────────────────────────
export const SEED_WEEKLY_SUMMARY: WeeklyReportSummary = {
  total_conversations: 127,
  total_scored: 127,
  avg_overall_score: 0.71,
  avg_accuracy: 0.73,
  avg_hallucination: 0.76,
  avg_resolution: 0.68,
  score_trend: -0.04,
  hallucination_count: 8,
  escalation_count: 12,
  top_failures: [
    { conversation_id: "conv-003", score: 0.38, summary: "Fabricated Figma integration" },
    { conversation_id: "conv-002", score: 0.45, summary: "Wrong refund amount quoted" },
  ],
  prompt_improvements: [
    { issue: "Agent fabricates integrations", current_behavior: "Describes non-existent features", recommended_prompt_change: "Add explicit integration list to system prompt", expected_impact: "Eliminate feature hallucinations", priority: "high" },
    { issue: "Billing amounts not verified", current_behavior: "Quotes amounts without checking", recommended_prompt_change: "Add verification step for all financial actions", expected_impact: "Prevent billing errors that cause escalation", priority: "high" },
  ],
  knowledge_gaps: [
    { topic: "integrations", description: "No comprehensive integration list in KB", affected_conversations: 3, suggested_content: "Create integration directory with feature details" },
  ],
};

// ─── Chart Data ────────────────────────────────────────────────────
export function generateTrendData(days: number = 30) {
  const data = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const baseScore = 0.72 + Math.sin(i / 5) * 0.08;
    data.push({
      date: d.toISOString().slice(0, 10),
      overall: +(baseScore + (Math.random() - 0.5) * 0.06).toFixed(2),
      accuracy: +(baseScore + 0.02 + (Math.random() - 0.5) * 0.08).toFixed(2),
      hallucination: +(baseScore + 0.04 + (Math.random() - 0.5) * 0.1).toFixed(2),
      resolution: +(baseScore - 0.03 + (Math.random() - 0.5) * 0.08).toFixed(2),
      conversations: Math.floor(15 + Math.random() * 20),
    });
  }
  return data;
}
