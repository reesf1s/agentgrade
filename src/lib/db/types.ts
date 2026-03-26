export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "enterprise";
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  monthly_conversation_limit: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  clerk_user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface AgentConnection {
  id: string;
  workspace_id: string;
  platform: "intercom" | "zendesk" | "custom" | "csv";
  name: string;
  api_key_encrypted?: string;
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  last_sync_at?: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  agent_connection_id?: string;
  external_id?: string;
  platform: string;
  started_at?: string;
  ended_at?: string;
  message_count: number;
  was_escalated: boolean;
  customer_identifier?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  quality_score?: QualityScore;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "agent" | "customer" | "human_agent" | "system";
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ClaimAnalysis {
  claim: string;
  verdict: "verified" | "unverifiable" | "contradicted" | "fabricated";
  evidence?: string;
  kb_source?: string;
}

export interface PromptImprovement {
  issue: string;
  current_behavior: string;
  recommended_prompt_change: string;
  expected_impact: string;
  priority: "high" | "medium" | "low";
}

export interface KnowledgeGap {
  topic: string;
  description: string;
  affected_conversations: number;
  suggested_content: string;
}

export interface QualityScore {
  id: string;
  conversation_id: string;
  overall_score: number;
  accuracy_score?: number;
  hallucination_score?: number;
  resolution_score?: number;
  tone_score?: number;
  sentiment_score?: number;
  structural_metrics: StructuralMetrics;
  claim_analysis: ClaimAnalysis[];
  flags: string[];
  summary?: string;
  prompt_improvements: PromptImprovement[];
  knowledge_gaps: KnowledgeGap[];
  scoring_model_version: string;
  scored_at: string;
}

export interface StructuralMetrics {
  turn_count: number;
  agent_turns: number;
  customer_turns: number;
  avg_agent_response_length: number;
  avg_customer_message_length: number;
  conversation_duration_seconds?: number;
  escalation_turn?: number;
  repetition_count: number;
  conversation_type: string;
  extracted_claims: string[];
  sentiment_per_turn: { turn: number; role: string; sentiment: number }[];
}

export interface QualityOverride {
  id: string;
  quality_score_id: string;
  dimension: string;
  original_score: number;
  override_score: number;
  reason?: string;
  overridden_by: string;
  created_at: string;
}

export interface FailurePattern {
  id: string;
  workspace_id: string;
  pattern_type: string;
  title: string;
  description: string;
  affected_conversation_ids: string[];
  severity: "low" | "medium" | "high" | "critical";
  recommendation?: string;
  prompt_fix?: string;
  knowledge_base_suggestion?: string;
  detected_at: string;
  is_resolved: boolean;
}

export interface WeeklyReport {
  id: string;
  workspace_id: string;
  week_start: string;
  week_end: string;
  summary: WeeklyReportSummary;
  generated_at: string;
}

export interface WeeklyReportSummary {
  total_conversations: number;
  total_scored: number;
  avg_overall_score: number;
  avg_accuracy: number;
  avg_hallucination: number;
  avg_resolution: number;
  score_trend: number; // positive = improving
  hallucination_count: number;
  escalation_count: number;
  top_failures: { conversation_id: string; score: number; summary: string }[];
  prompt_improvements: PromptImprovement[];
  knowledge_gaps: KnowledgeGap[];
}

export interface Alert {
  id: string;
  workspace_id: string;
  alert_type: string;
  title: string;
  description?: string;
  threshold_value?: number;
  actual_value?: number;
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface AlertConfig {
  id: string;
  workspace_id: string;
  dimension: string;
  threshold: number;
  enabled: boolean;
}
