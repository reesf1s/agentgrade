-- AgentGrade Database Schema
-- All tables use the ag_ prefix to avoid collisions with Supabase system tables.
-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/glkvrweabeilwnrpzqxg/sql

-- Enable pgvector for knowledge base embeddings
create extension if not exists vector;

-- ============================================================
-- WORKSPACES
-- ============================================================
create table if not exists ag_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Limits per plan: starter=5000, growth=25000, enterprise=-1 (unlimited)
  monthly_conversation_limit int not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table if not exists ag_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  clerk_user_id text not null,
  email text, -- stored for invite lookup
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, clerk_user_id)
);

-- ============================================================
-- AGENT CONNECTIONS
-- ============================================================
create table if not exists ag_agent_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  platform text not null check (platform in ('intercom', 'zendesk', 'custom', 'csv')),
  name text not null default 'My Agent',
  -- API key encrypted at rest (store Base64-encoded AES-GCM ciphertext)
  api_key_encrypted text,
  -- Webhook URL this connection should POST to
  webhook_url text,
  -- Secret used to authenticate inbound webhook calls
  webhook_secret text unique,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  -- Platform-specific config (e.g. Intercom app_id, region, etc.)
  config jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists ag_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  agent_connection_id uuid references ag_agent_connections(id) on delete set null,
  -- The ID from the originating platform (Intercom, Zendesk, etc.)
  external_id text,
  platform text not null,
  started_at timestamptz,
  ended_at timestamptz,
  message_count int not null default 0,
  was_escalated boolean not null default false,
  customer_identifier text, -- email or opaque customer ID
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  -- Idempotency: one external_id per workspace
  unique(workspace_id, external_id)
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists ag_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ag_conversations(id) on delete cascade,
  role text not null check (role in ('agent', 'customer', 'human_agent', 'system')),
  content text not null,
  timestamp timestamptz not null default now(),
  metadata jsonb default '{}'
);

-- ============================================================
-- QUALITY SCORES  (one per conversation)
-- ============================================================
create table if not exists ag_quality_scores (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references ag_conversations(id) on delete cascade,
  overall_score float not null,       -- 0.0–1.0 weighted average
  accuracy_score float,
  hallucination_score float,          -- 1.0 = no hallucinations
  resolution_score float,
  tone_score float,
  sentiment_score float,              -- 1.0 = customer satisfied
  -- How well the agent handled unusual/unexpected queries (1.0 = excellent, 0.8 = N/A)
  edge_case_score float,
  -- How appropriately the agent managed escalation (1.0 = perfect, 0.85 = N/A)
  escalation_score float,
  -- Structural metrics computed locally (no API call)
  structural_metrics jsonb default '{}',
  -- Array of { claim, verdict, evidence, kb_source }
  claim_analysis jsonb default '[]',
  -- Short list of qualitative flags ("hallucination_detected", etc.)
  flags jsonb default '[]',
  summary text,                        -- 1-2 sentence Claude summary
  -- Actionable prompt change recommendations
  prompt_improvements jsonb default '[]',
  -- Topics missing from the knowledge base
  knowledge_gaps jsonb default '[]',
  scoring_model_version text not null default 'v1',
  scored_at timestamptz not null default now()
);

-- ============================================================
-- QUALITY OVERRIDES  (human-in-the-loop calibration)
-- ============================================================
create table if not exists ag_quality_overrides (
  id uuid primary key default gen_random_uuid(),
  quality_score_id uuid not null references ag_quality_scores(id) on delete cascade,
  dimension text not null, -- 'overall'|'accuracy'|'hallucination'|'resolution'|'tone'|'sentiment'
  original_score float not null,
  override_score float not null,
  reason text,
  overridden_by text not null, -- Clerk user ID
  created_at timestamptz not null default now()
);

-- ============================================================
-- FAILURE PATTERNS  (cross-conversation systemic issues)
-- ============================================================
create table if not exists ag_failure_patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  pattern_type text not null,
  title text not null,
  description text not null,
  affected_conversation_ids uuid[] default '{}',
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  recommendation text,
  prompt_fix text,
  knowledge_base_suggestion text,
  detected_at timestamptz not null default now(),
  is_resolved boolean not null default false,
  resolved_at timestamptz
);

-- ============================================================
-- SUGGESTED FIXES  (derived from quality_scores; actionable)
-- ============================================================
create table if not exists ag_suggested_fixes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  -- 'prompt_improvement' | 'knowledge_gap'
  fix_type text not null check (fix_type in ('prompt_improvement', 'knowledge_gap')),
  title text not null,
  description text not null,
  current_behavior text,
  recommended_change text not null,
  expected_impact text,
  priority text not null check (priority in ('high', 'medium', 'low')) default 'medium',
  -- Conversations that surfaced this fix
  source_conversation_ids uuid[] default '{}',
  -- How many conversations have this same issue
  occurrence_count int not null default 1,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'pushed', 'dismissed')),
  approved_at timestamptz,
  approved_by text, -- Clerk user ID
  pushed_at timestamptz,
  push_result jsonb, -- e.g. { "platform": "intercom", "article_id": "..." }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- KNOWLEDGE BASE ITEMS
-- ============================================================
create table if not exists ag_knowledge_base_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  chunk_index int not null default 0,
  -- pgvector embedding (text-embedding-3-small = 1536 dims)
  embedding vector(1536),
  source_file text,           -- original filename
  source_url text,            -- e.g. Intercom article URL
  source_type text default 'upload' check (source_type in ('upload', 'intercom', 'manual')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEEKLY REPORTS
-- ============================================================
create table if not exists ag_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  -- Full WeeklyReportSummary JSON
  summary jsonb not null default '{}',
  generated_at timestamptz not null default now(),
  unique(workspace_id, week_start)
);

-- ============================================================
-- ALERTS
-- ============================================================
create table if not exists ag_alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  alert_type text not null, -- 'score_below_threshold' | 'hallucination_spike' | 'escalation_spike'
  title text not null,
  description text,
  threshold_value float,
  actual_value float,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text -- Clerk user ID
);

-- ============================================================
-- ALERT CONFIGS  (per-workspace thresholds)
-- ============================================================
create table if not exists ag_alert_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references ag_workspaces(id) on delete cascade,
  dimension text not null, -- 'overall' | 'accuracy' | 'hallucination' | 'resolution' | 'tone'
  threshold float not null, -- 0.0–1.0
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id, dimension)
);

-- ============================================================
-- BENCHMARKS  (aggregated cross-customer industry data)
-- ============================================================
create table if not exists ag_benchmarks (
  id uuid primary key default gen_random_uuid(),
  industry text,
  company_size_bucket text, -- 'startup' | 'smb' | 'enterprise'
  dimension text not null,
  percentile_25 float not null,
  percentile_50 float not null,
  percentile_75 float not null,
  sample_size int not null default 0,
  calculated_at timestamptz not null default now()
);

-- ============================================================
-- WEBHOOK EVENTS  (audit log of all inbound webhook calls)
-- ============================================================
create table if not exists ag_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references ag_workspaces(id) on delete set null,
  connection_id uuid references ag_agent_connections(id) on delete set null,
  event_source text not null, -- 'ingest' | 'intercom' | 'clerk' | 'stripe'
  event_type text,            -- e.g. 'conversation.admin.closed'
  payload jsonb,
  conversation_id uuid references ag_conversations(id) on delete set null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_ag_conversations_workspace on ag_conversations(workspace_id);
create index if not exists idx_ag_conversations_created on ag_conversations(created_at desc);
create index if not exists idx_ag_conversations_external on ag_conversations(workspace_id, external_id);
create index if not exists idx_ag_messages_conversation on ag_messages(conversation_id);
create index if not exists idx_ag_messages_timestamp on ag_messages(conversation_id, timestamp asc);
create index if not exists idx_ag_quality_scores_conversation on ag_quality_scores(conversation_id);
create index if not exists idx_ag_quality_scores_overall on ag_quality_scores(overall_score);
create index if not exists idx_ag_failure_patterns_workspace on ag_failure_patterns(workspace_id);
create index if not exists idx_ag_suggested_fixes_workspace on ag_suggested_fixes(workspace_id, status);
create index if not exists idx_ag_alerts_workspace on ag_alerts(workspace_id, triggered_at desc);
create index if not exists idx_ag_knowledge_base_workspace on ag_knowledge_base_items(workspace_id);
create index if not exists idx_ag_webhook_events_workspace on ag_webhook_events(workspace_id, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- (Service role key bypasses RLS; anon/client key is restricted)
-- ============================================================
alter table ag_workspaces enable row level security;
alter table ag_workspace_members enable row level security;
alter table ag_agent_connections enable row level security;
alter table ag_conversations enable row level security;
alter table ag_messages enable row level security;
alter table ag_quality_scores enable row level security;
alter table ag_quality_overrides enable row level security;
alter table ag_failure_patterns enable row level security;
alter table ag_suggested_fixes enable row level security;
alter table ag_knowledge_base_items enable row level security;
alter table ag_weekly_reports enable row level security;
alter table ag_alerts enable row level security;
alter table ag_alert_configs enable row level security;
alter table ag_webhook_events enable row level security;

-- Default deny all for anon key (service_role bypasses these)
-- Add workspace-scoped policies here when enabling client-side access.
