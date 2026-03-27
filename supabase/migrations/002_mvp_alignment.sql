create table if not exists suggested_fixes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  pattern_id uuid references failure_patterns(id) on delete set null,
  fix_type text not null check (fix_type in ('prompt_improvement', 'knowledge_gap')),
  intervention_type text not null check (
    intervention_type in (
      'knowledge_fix',
      'retrieval_or_prompt_fix',
      'escalation_policy_fix',
      'coverage_gap',
      'manual_review_required'
    )
  ),
  title text not null,
  description text not null,
  current_behavior text,
  recommended_change text not null,
  expected_impact text,
  priority text not null check (priority in ('high', 'medium', 'low')),
  source_conversation_ids uuid[] not null default '{}',
  occurrence_count integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved', 'pushed', 'verified', 'dismissed')),
  approved_at timestamptz,
  approved_by text,
  pushed_at timestamptz,
  push_result jsonb,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suggested_fixes_workspace on suggested_fixes(workspace_id, status);
create index if not exists idx_suggested_fixes_pattern on suggested_fixes(pattern_id);

alter table knowledge_base add column if not exists source_url text;
alter table knowledge_base add column if not exists source_type text;
update knowledge_base set source_type = coalesce(source_type, 'upload');

alter table workspace_members add column if not exists email text;
alter table quality_scores add column if not exists edge_case_score float;
alter table quality_scores add column if not exists escalation_score float;
alter table quality_scores add column if not exists confidence_level text;
