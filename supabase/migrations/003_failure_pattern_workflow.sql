alter table failure_patterns
  add column if not exists workflow_state text not null default 'new'
    check (workflow_state in ('new', 'monitoring', 'actioning', 'quieted', 'resolved')),
  add column if not exists workflow_updated_at timestamptz not null default now();

update failure_patterns
set
  workflow_state = case
    when is_resolved then 'resolved'
    else coalesce(workflow_state, 'new')
  end,
  workflow_updated_at = coalesce(workflow_updated_at, now());
