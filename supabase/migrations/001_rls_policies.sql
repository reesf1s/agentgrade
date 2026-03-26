-- RLS Policies for AgentGrade
-- Apply via Supabase Dashboard SQL Editor or supabase CLI
--
-- Strategy: service_role key bypasses RLS (used by all server-side webhook/API code).
-- These policies guard against unauthorized direct client access.
-- With Clerk auth (not Supabase Auth), client-side access goes through Next.js API
-- routes that use service_role, so these policies are defense-in-depth.

-- Helper: get workspace IDs for the current authenticated user
-- (Used when Clerk JWT is forwarded to Supabase via custom claims)
-- For now, all client access is proxied through server API routes using service_role,
-- so policies are intentionally restrictive (deny all direct client access).

-- Workspaces: only accessible via service_role
create policy "service_role_only" on workspaces
  for all using (false);

-- Workspace members: only accessible via service_role
create policy "service_role_only" on workspace_members
  for all using (false);

-- Agent connections: only accessible via service_role
create policy "service_role_only" on agent_connections
  for all using (false);

-- Conversations: only accessible via service_role
create policy "service_role_only" on conversations
  for all using (false);

-- Messages: only accessible via service_role
create policy "service_role_only" on messages
  for all using (false);

-- Quality scores: only accessible via service_role
create policy "service_role_only" on quality_scores
  for all using (false);

-- Quality overrides: only accessible via service_role
create policy "service_role_only" on quality_overrides
  for all using (false);

-- Failure patterns: only accessible via service_role
create policy "service_role_only" on failure_patterns
  for all using (false);

-- Weekly reports: only accessible via service_role
create policy "service_role_only" on weekly_reports
  for all using (false);

-- Alerts: only accessible via service_role
create policy "service_role_only" on alerts
  for all using (false);

-- Alert configs: only accessible via service_role
create policy "service_role_only" on alert_configs
  for all using (false);

-- Knowledge base: only accessible via service_role
create policy "service_role_only" on knowledge_base
  for all using (false);
