-- AgentGrade Database Schema
-- Run this in Supabase SQL editor

-- Enable pgvector extension
create extension if not exists vector;

-- Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  monthly_conversation_limit int not null default 5000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspace members
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  clerk_user_id text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, clerk_user_id)
);

-- Agent connections
create table agent_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  platform text not null check (platform in ('intercom', 'zendesk', 'custom', 'csv')),
  name text not null default 'My Agent',
  api_key_encrypted text,
  webhook_url text,
  webhook_secret text,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  config jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_connection_id uuid references agent_connections(id) on delete set null,
  external_id text,
  platform text not null,
  started_at timestamptz,
  ended_at timestamptz,
  message_count int not null default 0,
  was_escalated boolean not null default false,
  customer_identifier text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('agent', 'customer', 'human_agent', 'system')),
  content text not null,
  timestamp timestamptz not null default now(),
  metadata jsonb default '{}'
);

-- Quality scores
create table quality_scores (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade unique,
  overall_score float not null,
  accuracy_score float,
  hallucination_score float,
  resolution_score float,
  tone_score float,
  sentiment_score float,
  -- How well the agent handled unusual/unexpected queries (1.0 = excellent, 0.8 = N/A)
  edge_case_score float,
  -- How appropriately the agent managed escalation (1.0 = perfect, 0.85 = N/A)
  escalation_score float,
  structural_metrics jsonb default '{}',
  claim_analysis jsonb default '[]',
  flags jsonb default '[]',
  summary text,
  prompt_improvements jsonb default '[]',
  knowledge_gaps jsonb default '[]',
  scoring_model_version text not null default 'v1',
  scored_at timestamptz not null default now()
);

-- Quality overrides (human-in-the-loop)
create table quality_overrides (
  id uuid primary key default gen_random_uuid(),
  quality_score_id uuid not null references quality_scores(id) on delete cascade,
  dimension text not null,
  original_score float not null,
  override_score float not null,
  reason text,
  overridden_by text not null,
  created_at timestamptz not null default now()
);

-- Failure patterns
create table failure_patterns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pattern_type text not null,
  title text not null,
  description text not null,
  affected_conversation_ids uuid[] default '{}',
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  recommendation text,
  prompt_fix text,
  knowledge_base_suggestion text,
  detected_at timestamptz not null default now(),
  workflow_state text not null default 'new' check (workflow_state in ('new', 'monitoring', 'actioning', 'quieted', 'resolved')),
  workflow_updated_at timestamptz not null default now(),
  is_resolved boolean not null default false,
  resolved_at timestamptz
);

-- Weekly reports
create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  summary jsonb not null default '{}',
  generated_at timestamptz not null default now()
);

-- Alerts
create table alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  alert_type text not null,
  title text not null,
  description text,
  threshold_value float,
  actual_value float,
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text
);

-- Alert configurations
create table alert_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  dimension text not null,
  threshold float not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id, dimension)
);

-- Knowledge base documents
create table knowledge_base (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  chunk_index int not null default 0,
  embedding vector(1536),
  source_file text,
  created_at timestamptz not null default now()
);

-- Benchmarks (aggregated cross-customer)
create table benchmarks (
  id uuid primary key default gen_random_uuid(),
  industry text,
  company_size_bucket text,
  dimension text not null,
  percentile_25 float not null,
  percentile_50 float not null,
  percentile_75 float not null,
  sample_size int not null default 0,
  calculated_at timestamptz not null default now()
);

-- Indexes
create index idx_conversations_workspace on conversations(workspace_id);
create index idx_conversations_created on conversations(created_at desc);
create index idx_messages_conversation on messages(conversation_id);
create index idx_quality_scores_conversation on quality_scores(conversation_id);
create index idx_quality_scores_overall on quality_scores(overall_score);
create index idx_failure_patterns_workspace on failure_patterns(workspace_id);
create index idx_alerts_workspace on alerts(workspace_id);
create index idx_knowledge_base_workspace on knowledge_base(workspace_id);

-- pgvector index for fast cosine similarity search on KB embeddings
-- Uses IVFFlat (approximate) — faster than exact search at scale
-- Build after inserting initial data: set lists = sqrt(row_count)
create index idx_knowledge_base_embedding on knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─── pgvector Semantic Search Function ─────────────────────────────
-- Called by src/lib/knowledge-base/index.ts → searchKnowledgeBase()
-- Returns top-K chunks ordered by cosine similarity to query embedding
create or replace function match_knowledge_base(
  p_workspace_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  source_file text,
  similarity float,
  chunk_index int
)
language sql stable
as $$
  select
    kb.id,
    kb.title,
    kb.content,
    kb.source_file,
    1 - (kb.embedding <=> p_query_embedding) as similarity,
    kb.chunk_index
  from knowledge_base kb
  where
    kb.workspace_id = p_workspace_id
    and kb.embedding is not null
    -- Only return chunks with meaningful similarity (>20%)
    and 1 - (kb.embedding <=> p_query_embedding) > 0.2
  order by kb.embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- ─── Migration: add edge_case_score and escalation_score ────────────
-- Run this if you already created the quality_scores table without these columns:
--
--   alter table quality_scores add column if not exists edge_case_score float;
--   alter table quality_scores add column if not exists escalation_score float;

-- Enable RLS
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table agent_connections enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table quality_scores enable row level security;
alter table quality_overrides enable row level security;
alter table failure_patterns enable row level security;
alter table weekly_reports enable row level security;
alter table alerts enable row level security;
alter table alert_configs enable row level security;
alter table knowledge_base enable row level security;
