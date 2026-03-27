"use client";
import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { Plug, Bell, Users, CreditCard, BookOpen, Trash2, Copy, Check, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Connection {
  id: string;
  platform: string;
  name: string;
  is_active: boolean;
  last_sync_at?: string;
  webhook_url?: string;
  created_at: string;
}

interface ConnectionSetupDetails {
  webhook_url: string;
  api_key: string;
  snippet: string;
  env_example: string;
  install_steps: string[];
  env_help: Record<string, string>;
}

interface TeamMember {
  id: string;
  clerk_user_id: string;
  email?: string;
  role: string;
  created_at: string;
}

interface KBSource {
  source: string;
  source_type: string;
  chunks: number;
  created_at: string;
  id: string;
}

interface BillingData {
  plan: string;
  price: string;
  usage: number;
  limit: number | null;
  configured?: boolean;
}

// ─── Tab: Connections ─────────────────────────────────────────────────────────

function ConnectionsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [setupLoading, setSetupLoading] = useState<string | null>(null);
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const [setupByConnection, setSetupByConnection] = useState<Record<string, ConnectionSetupDetails>>({});
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/ingest`
    : "/api/webhooks/ingest";

  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.connections || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function syncConnection(id: string) {
    setSyncing(id);
    try {
      await fetch(`/api/connections/${id}/sync`, { method: "POST" });
      const r = await fetch("/api/connections");
      const d = await r.json();
      setConnections(d.connections || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(null);
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm("Remove this connection?")) return;
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function loadSetup(connectionId: string) {
    if (setupByConnection[connectionId]) {
      setExpandedConnectionId((current) => (current === connectionId ? null : connectionId));
      return;
    }

    setSetupLoading(connectionId);
    try {
      const response = await fetch(`/api/connections/${connectionId}/sdk-snippet`);
      const data = await response.json();

      if (response.ok) {
        setSetupByConnection((current) => ({
          ...current,
          [connectionId]: {
            webhook_url: data.webhook_url,
            api_key: data.api_key,
            snippet: data.snippet,
            env_example: data.env_example,
            install_steps: data.install_steps || [],
            env_help: data.env_help || {},
          },
        }));
        setExpandedConnectionId(connectionId);
      }
    } catch (error) {
      console.error("Failed to load connection setup:", error);
    } finally {
      setSetupLoading(null);
    }
  }

  function copyText(value: string) {
    navigator.clipboard.writeText(value).catch(console.error);
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Agent Connections</h2>
        <p className="mb-4 text-xs text-[var(--text-muted)]">
          Connect as many bots as you need. Each connection gets its own bearer secret, webhook, and audit trail.
        </p>

        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading connections...</p>
        ) : connections.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">
            No connections yet. Add one below to start ingesting conversations.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {connections.map((conn) => (
              <div key={conn.id} className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{conn.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 capitalize">
                      {conn.platform} &middot; {conn.is_active ? "Active" : "Inactive"}
                      {conn.last_sync_at ? ` &middot; Last sync: ${new Date(conn.last_sync_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.is_active && <span className="w-2 h-2 rounded-full bg-score-good" />}
                    <GlassButton size="sm" onClick={() => loadSetup(conn.id)}>
                      {setupLoading === conn.id
                        ? "Loading..."
                        : expandedConnectionId === conn.id
                          ? "Hide setup"
                          : "Setup"}
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      onClick={() => syncConnection(conn.id)}
                      disabled={syncing === conn.id}
                    >
                      {syncing === conn.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        "Sync now"
                      )}
                    </GlassButton>
                    <button
                      onClick={() => deleteConnection(conn.id)}
                      className="text-[var(--text-muted)] hover:text-score-critical transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandedConnectionId === conn.id && setupByConnection[conn.id] && (
                  <div className="mt-4 space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-5">
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Integration steps
                      </p>
                      <ol className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                        {setupByConnection[conn.id].install_steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[11px] font-semibold text-[var(--text-primary)]">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Webhook endpoint</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={setupByConnection[conn.id].webhook_url}
                          className="glass-input flex-1 px-3 py-2 text-xs font-mono"
                        />
                        <GlassButton size="sm" onClick={() => copyText(setupByConnection[conn.id].webhook_url)}>
                          <Copy className="w-4 h-4" />
                        </GlassButton>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Bearer secret</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={setupByConnection[conn.id].api_key}
                          className="glass-input flex-1 px-3 py-2 text-xs font-mono"
                        />
                        <GlassButton size="sm" onClick={() => copyText(setupByConnection[conn.id].api_key)}>
                          <Copy className="w-4 h-4" />
                        </GlassButton>
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Send every transcript update with `Authorization: Bearer &lt;secret&gt;`. Re-sending the same `conversation_id` now appends new messages and re-scores instead of being ignored.
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium text-[var(--text-primary)]">Env vars for your app</p>
                        <GlassButton size="sm" onClick={() => copyText(setupByConnection[conn.id].env_example)}>
                          Copy env vars
                        </GlassButton>
                      </div>
                      <pre className="overflow-x-auto rounded-xl bg-[rgba(0,0,0,0.03)] p-3 text-xs text-[var(--text-secondary)]">
                        {setupByConnection[conn.id].env_example}
                      </pre>
                      <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                        {Object.entries(setupByConnection[conn.id].env_help).map(([key, value]) => (
                          <p key={key}>
                            <span className="font-mono text-[var(--text-primary)]">{key}</span>: {value}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Quick test</p>
                      <pre className="overflow-x-auto rounded-xl bg-[rgba(0,0,0,0.03)] p-3 text-xs text-[var(--text-secondary)]">
{`curl -X POST ${setupByConnection[conn.id].webhook_url} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${setupByConnection[conn.id].api_key}" \\
  -d '{
    "conversation_id": "demo-123",
    "platform": "custom",
    "customer_identifier": "demo-user",
    "messages": [
      { "role": "customer", "content": "How do I reset my password?" },
      { "role": "agent", "content": "Use the Forgot password link on your login page." }
    ]
  }'`}
                      </pre>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium text-[var(--text-primary)]">JavaScript snippet</p>
                        <GlassButton size="sm" onClick={() => copyText(setupByConnection[conn.id].snippet)}>
                          Copy snippet
                        </GlassButton>
                      </div>
                      <pre className="overflow-x-auto rounded-xl bg-[rgba(0,0,0,0.03)] p-3 text-xs text-[var(--text-secondary)]">
                        {setupByConnection[conn.id].snippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3 mt-2">Add new connection</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Intercom", platform: "intercom" },
            { label: "Zendesk", platform: "zendesk" },
            { label: "Voiceflow", platform: "voiceflow" },
            { label: "Custom Webhook", platform: "custom" },
          ].map((option) => (
            <button
              key={option.platform}
              className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.04)] transition-colors text-center"
              onClick={() => {
                window.location.href = `/onboarding?platform=${option.platform}`;
              }}
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">{option.label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Connect</p>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Or upload conversations</h3>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/onboarding?platform=csv";
            }}
            className="w-full border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors"
          >
            <p className="text-sm text-[var(--text-secondary)]">Drop CSV or JSON file here</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Supports any conversation format</p>
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Webhook URL</h2>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Send conversations to this URL from any platform
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            className="glass-input flex-1 px-3 py-2 text-xs font-mono"
          />
          <GlassButton size="sm" onClick={copyWebhook}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Tab: Alert Thresholds ────────────────────────────────────────────────────

const THRESHOLD_DIMS = [
  { dim: "overall", label: "Overall Quality" },
  { dim: "accuracy", label: "Accuracy" },
  { dim: "hallucination", label: "Hallucination" },
  { dim: "resolution", label: "Resolution" },
];

function AlertsTab() {
  const [configs, setConfigs] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/alerts/config")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const cfg of d.configs || []) {
          map[cfg.dimension] = Math.round((cfg.threshold ?? 0) * 100);
        }
        setConfigs(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function saveThresholds() {
    setSaving(true);
    try {
      await fetch("/api/alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholds: THRESHOLD_DIMS.map((d) => ({
            dimension: d.dim,
            threshold: (configs[d.dim] ?? 70) / 100,
            enabled: true,
          })),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Alert Thresholds</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">Get notified when quality drops below these thresholds.</p>
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading...</p>
      ) : (
        <div className="space-y-4">
          {THRESHOLD_DIMS.map(({ dim, label }) => (
            <div key={dim} className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Alert below</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={configs[dim] ?? 70}
                  onChange={(e) =>
                    setConfigs((prev) => ({ ...prev, [dim]: parseInt(e.target.value) || 0 }))
                  }
                  className="glass-input w-16 px-2 py-1 text-sm text-center font-mono"
                />
                <span className="text-xs text-[var(--text-muted)]">%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <GlassButton className="mt-6" onClick={saveThresholds} disabled={saving || loading}>
        {saved ? "Saved!" : saving ? "Saving..." : "Save thresholds"}
      </GlassButton>
    </GlassCard>
  );
}

// ─── Tab: Team ────────────────────────────────────────────────────────────────

function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError(null);
    try {
      const r = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setInviteError(d.error || "Failed to invite");
      } else {
        setInviteEmail("");
      }
    } catch {
      setInviteError("Network error");
    } finally {
      setInviting(false);
    }
  }

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Team Members</h2>
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading...</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] mb-6">No team members yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {m.email || m.clerk_user_id}
                </p>
                <p className="text-xs text-[var(--text-muted)] capitalize">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {inviteError && (
        <p className="text-xs text-score-critical mb-3">{inviteError}</p>
      )}
      <div className="flex gap-2">
        <GlassInput
          placeholder="Email address"
          className="flex-1"
          value={inviteEmail}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
        />
        <GlassButton onClick={invite} disabled={inviting || !inviteEmail}>
          {inviting ? "Inviting..." : "Invite"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

// ─── Tab: Knowledge Base ──────────────────────────────────────────────────────

function KnowledgeTab() {
  const [sources, setSources] = useState<KBSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [syncingUrl, setSyncingUrl] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/knowledge-base")
      .then((r) => r.json())
      .then((d) => setSources(d.sources || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function deleteSource(id: string) {
    if (!confirm("Delete this knowledge base item?")) return;
    await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function ingestUrl() {
    if (!sourceUrl) return;
    setSyncingUrl(true);
    setUrlError(null);
    try {
      const response = await fetch("/api/knowledge-base/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        setUrlError(data.error || "Failed to ingest URL");
        return;
      }
      setSourceUrl("");
      const refreshed = await fetch("/api/knowledge-base");
      const refreshedData = await refreshed.json();
      setSources(refreshedData.sources || []);
    } catch {
      setUrlError("Network error");
    } finally {
      setSyncingUrl(false);
    }
  }

  async function syncHelpCenter(platform: "intercom" | "zendesk") {
    setSyncingPlatform(platform);
    setUrlError(null);
    try {
      const response = await fetch("/api/knowledge-base/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await response.json();
      if (!response.ok) {
        setUrlError(data.error || `Failed to sync ${platform} knowledge base`);
        return;
      }
      const refreshed = await fetch("/api/knowledge-base");
      const refreshedData = await refreshed.json();
      setSources(refreshedData.sources || []);
    } catch {
      setUrlError("Network error");
    } finally {
      setSyncingPlatform(null);
    }
  }

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Knowledge Base</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Upload your help docs, FAQs, and policies. Used to verify agent accuracy and detect hallucinations.
      </p>
      <div className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer mb-4">
        <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files here</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Files are chunked and embedded for semantic search</p>
      </div>
      <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
        <p className="text-xs font-medium text-[var(--text-primary)] mb-3">Or import a help center URL</p>
        <div className="flex gap-2">
          <GlassInput
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://help.example.com/article"
            className="flex-1"
          />
          <GlassButton onClick={ingestUrl} disabled={!sourceUrl || syncingUrl}>
            {syncingUrl ? "Importing..." : "Import URL"}
          </GlassButton>
        </div>
        {urlError ? <p className="mt-2 text-xs text-score-critical">{urlError}</p> : null}
      </div>
      <div className="mb-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
        <p className="text-xs font-medium text-[var(--text-primary)] mb-3">Sync from a connected help center</p>
        <div className="flex flex-wrap gap-2">
          <GlassButton
            onClick={() => syncHelpCenter("intercom")}
            disabled={syncingPlatform !== null}
          >
            {syncingPlatform === "intercom" ? "Syncing Intercom..." : "Sync Intercom Articles"}
          </GlassButton>
          <GlassButton
            onClick={() => syncHelpCenter("zendesk")}
            disabled={syncingPlatform !== null}
          >
            {syncingPlatform === "zendesk" ? "Syncing Zendesk..." : "Sync Zendesk Help Center"}
          </GlassButton>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading...</p>
      ) : sources.length === 0 ? (
        <div className="py-4 text-center text-sm text-[var(--text-muted)]">
          No knowledge base items yet. Upload documents to improve accuracy scoring.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
              <div>
                <p className="text-sm text-[var(--text-primary)]">{s.source}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {s.chunks} chunk{s.chunks !== 1 ? "s" : ""} &middot; Uploaded {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                className="text-[var(--text-muted)] hover:text-score-critical transition-colors"
                onClick={() => deleteSource(s.id)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

function BillingTab() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d) => setBilling(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    setBillingError(null);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setBillingError(d.error || "Unable to open the Stripe portal right now.");
        return;
      }
      if (d.url) window.location.href = d.url;
    } catch (e) {
      console.error(e);
      setBillingError("Unable to open the Stripe portal right now.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function openCheckout() {
    setBillingError(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "growth" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setBillingError(d.error || "Unable to start checkout.");
        return;
      }
      if (d.url) window.location.href = d.url;
    } catch (e) {
      console.error(e);
      setBillingError("Unable to start checkout.");
    }
  }

  if (loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-[var(--text-muted)]">Loading billing...</p>
      </GlassCard>
    );
  }

  const usagePct = billing?.limit
    ? Math.min(100, ((billing.usage ?? 0) / billing.limit) * 100)
    : 0;

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Billing</h2>
      {billing ? (
        <>
          {!billing.configured && (
            <div className="mb-4 rounded-[1.25rem] border border-amber-200/70 bg-amber-50/70 p-4 text-sm text-amber-900">
              Stripe is not configured in production yet. Billing screens are wired, but checkout and the portal will stay unavailable until `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set in Vercel.
            </div>
          )}

          {billingError && (
            <div className="mb-4 rounded-[1.25rem] border border-red-200/70 bg-red-50/70 p-4 text-sm text-red-700">
              {billingError}
            </div>
          )}

          <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)] mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{billing.plan} Plan</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {billing.price} &middot; {billing.limit ? billing.limit.toLocaleString() : "Unlimited"} conversations
                </p>
              </div>
              {billing.plan !== "enterprise" && (
                <GlassButton size="sm" onClick={openCheckout} disabled={!billing.configured}>Upgrade</GlassButton>
              )}
            </div>
            {billing.limit && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)]">Usage this month</span>
                  <span className="text-[var(--text-primary)] font-mono">
                    {(billing.usage ?? 0).toLocaleString()} / {billing.limit.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[rgba(0,0,0,0.04)]">
                  <div
                    className="h-full rounded-full bg-[var(--text-primary)]"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <GlassButton onClick={openPortal} disabled={portalLoading || !billing.configured}>
            {portalLoading ? "Opening..." : "Manage billing"}
          </GlassButton>
        </>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Unable to load billing information.</p>
      )}
    </GlassCard>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("connections");

  const tabs = [
    { id: "connections", label: "Connections", icon: Plug },
    { id: "alerts", label: "Alert Thresholds", icon: Bell },
    { id: "team", label: "Team", icon: Users },
    { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
      </div>

      <div className="flex gap-6">
        {/* Tab nav */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-left ${
                  activeTab === tab.id
                    ? "bg-[rgba(0,0,0,0.05)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[rgba(0,0,0,0.02)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "team" && <TeamTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
          {activeTab === "billing" && <BillingTab />}
        </div>
      </div>
    </div>
  );
}
