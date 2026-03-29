"use client";
import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { Plug, Bell, Users, CreditCard, BookOpen, Trash2, Copy, Check, RefreshCw, Brain } from "lucide-react";

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

interface CalibrationInfo {
  scorer: {
    evaluator_model: string;
    evaluator_provider: string;
    evaluation_mode: string;
    calibration_note: string;
    scoring_model_version: string;
    supported_dimensions: Array<{ key: string; label: string }>;
    share_scope_options: Array<{ key: string; label: string; description: string }>;
    example_kind_options: Array<{ key: string; label: string; description: string }>;
    repo_eval_cases: number;
    labeled_examples: number;
    manual_calibration_conversations: number;
    learned_calibration: {
      mode: "inactive" | "active";
      training_mode: "llm_judge_plus_calibration_model";
      workspace_private_labels: number;
      global_shared_labels: number;
      workspace_model: {
        active: boolean;
        label_count: number;
        trained_dimensions: string[];
        mean_abs_error?: number;
        last_label_at?: string;
      };
      global_model: {
        active: boolean;
        label_count: number;
        trained_dimensions: string[];
        mean_abs_error?: number;
        last_label_at?: string;
      };
    };
    training_stage: {
      key: "bootstrapping" | "calibrating" | "adaptive";
      label: string;
      description: string;
    };
    model_card: {
      scorer_name: string;
      version_family: string;
      base_evaluator: {
        provider: string;
        model: string;
        role: string;
      };
      learned_layers: Array<{
        name: string;
        status: string;
        purpose: string;
      }>;
      privacy: {
        workspace_private: string;
        global_anonymous: string;
      };
      strengths: string[];
      current_limitations: string[];
      active_improvements: string[];
      path_to_proprietary_model: string[];
    };
    training_insights: {
      review_queue: Array<{
        conversation_id: string;
        customer_identifier?: string;
        platform?: string;
        created_at: string;
        overall_score: number;
        confidence_level: "high" | "medium" | "low";
        reason: string;
        priority_score: number;
      }>;
      label_coverage: {
        total_gold_set_conversations: number;
        real_examples: number;
        synthetic_examples: number;
        private_examples: number;
        shared_examples: number;
        dimensions: Array<{
          key: string;
          label: string;
          label_count: number;
          healthy: boolean;
        }>;
      };
      roadmap: {
        next_workspace_label_milestone: number;
        next_shared_label_milestone: number;
        best_next_steps: string[];
      };
    };
  };
  recent_labels: Array<{
    id: string;
    conversation_id: string;
    customer_identifier?: string;
    dimension: string;
    override_score: number;
    reason?: string;
    created_at: string;
    source: "pasted" | "existing";
    share_scope: "workspace_private" | "global_anonymous";
    example_kind: "real" | "synthetic";
  }>;
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="enterprise-kicker">Connections</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Connect an assistant in minutes
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Add a webhook, test the connection, and start reviewing real conversations without engineering overhead.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Fastest setup path
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Intercom", platform: "intercom" },
            { label: "Zendesk", platform: "zendesk" },
            { label: "Voiceflow", platform: "voiceflow" },
            { label: "Custom webhook", platform: "custom" },
          ].map((option) => (
            <button
              key={option.platform}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 text-left transition-colors hover:bg-[var(--surface-hover)]"
              onClick={() => {
                window.location.href = `/onboarding?platform=${option.platform}`;
              }}
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">{option.label}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Connect and generate setup details</p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Webhook endpoint</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={webhookUrl}
                className="glass-input flex-1 px-3 py-2 text-xs font-mono"
              />
              <GlassButton size="sm" onClick={copyWebhook}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </GlassButton>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              Use this if you want to wire any chatbot manually. Each saved connection also gets its own secret and install snippet below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/onboarding?platform=csv";
            }}
            className="rounded-2xl border-2 border-dashed border-[var(--border-subtle)] p-5 text-left transition-colors hover:border-[var(--border-strong)]"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">Upload past conversations</p>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
              Drop in CSV or JSON if you want to score historical data before wiring a live integration.
            </p>
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Connected assistants</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading connections...</p>
        ) : connections.length === 0 ? (
          <div className="py-6 text-center text-sm text-[var(--text-muted)]">
            No live assistants connected yet. Use one of the setup options above to get started.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {connections.map((conn) => (
              <div key={conn.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
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
                      <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3 text-xs text-[var(--text-secondary)]">
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
                      <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3 text-xs text-[var(--text-secondary)]">
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
                      <pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-3 text-xs text-[var(--text-secondary)]">
                        {setupByConnection[conn.id].snippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [syncingUrl, setSyncingUrl] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function uploadKnowledgeFile(file: File) {
    setUploadingFile(true);
    setUrlError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        setUrlError(data.error || "Failed to upload knowledge file");
        return;
      }

      const refreshed = await fetch("/api/knowledge-base");
      const refreshedData = await refreshed.json();
      setSources(refreshedData.sources || []);
    } catch {
      setUrlError("Network error");
    } finally {
      setUploadingFile(false);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadKnowledgeFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mb-4 w-full rounded-xl border-2 border-dashed border-[var(--border-subtle)] p-8 text-center transition-colors hover:border-[var(--border-strong)]"
      >
        <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-secondary)]">
          {uploadingFile ? "Uploading knowledge file..." : "Upload PDF, DOCX, TXT, Markdown, or JSON"}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Files are chunked and embedded for semantic search</p>
      </button>
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
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
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

          <div className="mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
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
                <div className="h-1.5 rounded-full bg-[var(--surface)]">
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

function CalibrationTab() {
  const [data, setData] = useState<CalibrationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [shareScope, setShareScope] = useState<"workspace_private" | "global_anonymous">("workspace_private");
  const [exampleKind, setExampleKind] = useState<"real" | "synthetic">("synthetic");
  const [labels, setLabels] = useState<Record<string, string>>({
    overall: "",
    accuracy: "",
    hallucination: "",
    resolution: "",
    escalation: "",
    tone: "",
    sentiment: "",
  });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/calibration");
      const payload = await response.json();
      setData(payload);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitCalibrationExample() {
    setSaving(true);
    setState("idle");
    try {
      const response = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          transcript,
          notes,
          labels,
          share_scope: shareScope,
          example_kind: exampleKind,
        }),
      });

      if (!response.ok) {
        setState("error");
        return;
      }

      setState("saved");
      setTitle("");
      setTranscript("");
      setNotes("");
      setShareScope("workspace_private");
      setExampleKind("synthetic");
      setLabels({
        overall: "",
        accuracy: "",
        hallucination: "",
        resolution: "",
        escalation: "",
        tone: "",
        sentiment: "",
      });
      await load();
    } catch (error) {
      console.error(error);
      setState("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-[var(--text-muted)]">Loading calibration tools...</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="enterprise-section-title">Improve scoring</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Train the scorer like an internal quality team
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              Review real conversations, add synthetic edge cases, and tighten how AgentGrade judges your assistant. Private labels improve your workspace. Shared opt-in labels improve the anonymized global model.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            {data?.scorer.training_stage.label}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">
          {data?.scorer.training_stage.description}
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4 text-sm">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[var(--text-muted)]">Base evaluator</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">
              {data?.scorer.evaluator_provider} / {data?.scorer.evaluator_model}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[var(--text-muted)]">Scoring version</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">{data?.scorer.scoring_model_version}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[var(--text-muted)]">Repo eval cases</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">{data?.scorer.repo_eval_cases}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-[var(--text-muted)]">Human labels</p>
            <p className="mt-1 font-medium text-[var(--text-primary)]">{data?.scorer.labeled_examples}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Quick actions</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Create a synthetic test case</p>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  Add a crafted conversation for a failure mode, edge case, or regression you want the scorer to learn.
                </p>
                <GlassButton className="mt-4 w-full" onClick={() => document.getElementById("training-example-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  Create training example
                </GlassButton>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text-primary)]">Label real conversations</p>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  Open the highest-value conversations that will improve the scorer fastest for your workspace.
                </p>
                <GlassButton className="mt-4 w-full" onClick={() => document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                  Review suggested conversations
                </GlassButton>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Workspace Model</p>
            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
              {data?.scorer.learned_calibration.workspace_model.active ? "Active" : "Not enough labels yet"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {data?.scorer.learned_calibration.workspace_private_labels} private labels across this workspace
            </p>
            {data?.scorer.learned_calibration.workspace_model.mean_abs_error !== undefined ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Holdout MAE: {(data.scorer.learned_calibration.workspace_model.mean_abs_error * 100).toFixed(1)} points
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Global Anonymized Model</p>
            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
              {data?.scorer.learned_calibration.global_model.active ? "Active" : "Waiting for shared labels"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {data?.scorer.learned_calibration.global_shared_labels} shared anonymized labels from opted-in workspaces
            </p>
            {data?.scorer.learned_calibration.global_model.mean_abs_error !== undefined ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Holdout MAE: {(data.scorer.learned_calibration.global_model.mean_abs_error * 100).toFixed(1)} points
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">{data?.scorer.calibration_note}</p>
      </GlassCard>

      <GlassCard id="training-example-form" className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Create a training example</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Paste a transcript with lines like <span className="font-mono">Customer:</span>, <span className="font-mono">AI Agent:</span>, <span className="font-mono">Human Agent:</span>, or <span className="font-mono">Tool:</span>.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            {exampleKind === "synthetic" ? "Synthetic" : "Real"}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <GlassInput label="Example title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Crestline health trend example" />
          <div className="grid gap-3 md:grid-cols-2">
            <GlassSelect
              label="Example type"
              value={exampleKind}
              onChange={(event) => setExampleKind(event.target.value as "real" | "synthetic")}
              options={(data?.scorer.example_kind_options || []).map((option) => ({
                value: option.key,
                label: option.label,
              }))}
            />
            <GlassSelect
              label="Training scope"
              value={shareScope}
              onChange={(event) => setShareScope(event.target.value as "workspace_private" | "global_anonymous")}
              options={(data?.scorer.share_scope_options || []).map((option) => ({
                value: option.key,
                label: option.label,
              }))}
            />
          </div>
        </div>
        <GlassTextarea
          className="mt-3 min-h-[220px]"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder={"Customer: What changed and when?\nAI Agent: Here's the timeline...\nTool: get_deal_health(...) => ..."}
        />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {data?.scorer.supported_dimensions.map((dimension) => (
            <div key={dimension.key}>
              <p className="mb-1 text-xs text-[var(--text-secondary)]">{dimension.label}</p>
              <input
                type="number"
                min={0}
                max={100}
                value={labels[dimension.key] || ""}
                onChange={(event) =>
                  setLabels((current) => ({
                    ...current,
                    [dimension.key]: event.target.value,
                  }))
                }
                className="glass-input w-full px-3 py-2 text-sm"
                placeholder="%"
              />
            </div>
          ))}
        </div>
        <GlassTextarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-3 min-h-[96px]"
          placeholder="Explain the correct judgment. Capture grounding, user intent, escalation quality, and any org policy context."
        />
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Shared learning uses anonymized score features plus your labels. Raw transcript text stays private.
          </p>
          <GlassButton className="md:min-w-[220px]" onClick={submitCalibrationExample} disabled={saving}>
            {saving ? "Saving..." : "Save training example"}
          </GlassButton>
        </div>
        {state === "saved" ? <p className="mt-3 text-xs text-score-good">Training example saved.</p> : null}
        {state === "error" ? <p className="mt-3 text-xs text-score-critical">Failed to save training example.</p> : null}
      </GlassCard>

      <GlassCard className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Where to focus next</h2>
        <p className="mb-4 text-xs leading-5 text-[var(--text-secondary)]">
          These are the highest-leverage steps if you want the scorer to improve quickly without wasting review time.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Training examples</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {data?.scorer.training_insights.label_coverage.total_gold_set_conversations || 0}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Real: {data?.scorer.training_insights.label_coverage.real_examples || 0} · Synthetic: {data?.scorer.training_insights.label_coverage.synthetic_examples || 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Next private milestone</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {data?.scorer.training_insights.roadmap.next_workspace_label_milestone || 30}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Private labels needed for a stronger workspace-specific scorer
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Next shared milestone</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {data?.scorer.training_insights.roadmap.next_shared_label_milestone || 50}
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Shared anonymized labels needed to strengthen the cross-org model
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Best next steps</p>
          <div className="mt-3 space-y-2">
            {data?.scorer.training_insights.roadmap.best_next_steps.map((step) => (
              <p key={step} className="text-xs leading-5 text-[var(--text-secondary)]">• {step}</p>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard id="review-queue" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Label real conversations next</h2>
        <p className="mb-4 text-xs leading-5 text-[var(--text-secondary)]">
          These conversations are the highest-value places to add labels right now.
        </p>
        <div className="space-y-3">
          {data?.scorer.training_insights.review_queue.length ? data.scorer.training_insights.review_queue.map((item) => (
            <div key={item.conversation_id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {item.customer_identifier || item.conversation_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)] capitalize">
                    {item.platform || "custom"} · Score {(item.overall_score * 100).toFixed(0)}% · Confidence {item.confidence_level}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-[var(--panel-subtle)] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Priority {item.priority_score.toFixed(2)}
                  </span>
                  <GlassButton size="sm" onClick={() => { window.location.href = `/conversations/${item.conversation_id}`; }}>
                    Review
                  </GlassButton>
                </div>
              </div>
            </div>
          )) : (
            <p className="text-sm text-[var(--text-muted)]">No unlabeled high-value conversations right now.</p>
          )}
        </div>
      </GlassCard>

      <details className="group rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Model details and coverage</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Open this when you want to inspect coverage, privacy, and how the scorer is currently built.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] group-open:hidden">
            Expand
          </span>
        </summary>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Coverage snapshot</p>
            <div className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
              <p>Private examples: {data?.scorer.training_insights.label_coverage.private_examples || 0}</p>
              <p>Shared examples: {data?.scorer.training_insights.label_coverage.shared_examples || 0}</p>
              <p>Real examples: {data?.scorer.training_insights.label_coverage.real_examples || 0}</p>
              <p>Synthetic examples: {data?.scorer.training_insights.label_coverage.synthetic_examples || 0}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Coverage by score dimension</p>
            <div className="mt-3 space-y-2">
              {data?.scorer.training_insights.label_coverage.dimensions.map((dimension) => (
                <div key={dimension.key} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">{dimension.label}</span>
                  <span className={dimension.healthy ? "score-good" : "score-warning"}>
                    {dimension.label_count} labels
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">What runs in production</p>
            <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
              {data?.scorer.model_card.base_evaluator.provider} / {data?.scorer.model_card.base_evaluator.model}
            </p>
            <div className="mt-3 space-y-2">
              {data?.scorer.model_card.strengths.map((item) => (
                <p key={item} className="text-xs leading-5 text-[var(--text-secondary)]">• {item}</p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Privacy posture</p>
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-5 text-[var(--text-secondary)]">{data?.scorer.model_card.privacy.workspace_private}</p>
              <p className="text-xs leading-5 text-[var(--text-secondary)]">{data?.scorer.model_card.privacy.global_anonymous}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Roadmap to a proprietary scorer</p>
          <div className="mt-3 space-y-2">
            {data?.scorer.model_card.path_to_proprietary_model.map((item) => (
              <p key={item} className="text-xs leading-5 text-[var(--text-secondary)]">• {item}</p>
            ))}
          </div>
        </div>
      </details>

      <GlassCard className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Recent training activity</h2>
        <div className="space-y-3">
          {data?.recent_labels?.length ? data.recent_labels.map((label) => (
            <div key={label.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--text-primary)]">{label.customer_identifier || label.conversation_id}</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-[var(--panel-subtle)] px-2 py-1 capitalize text-[var(--text-muted)]">{label.source}</span>
                  <span className="rounded-full bg-[var(--panel-subtle)] px-2 py-1 capitalize text-[var(--text-muted)]">{label.example_kind}</span>
                  <span className="rounded-full bg-[var(--panel-subtle)] px-2 py-1 text-[var(--text-muted)]">
                    {label.share_scope === "global_anonymous" ? "shared" : "private"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {label.dimension} · {(label.override_score * 100).toFixed(0)}%
              </p>
              {label.reason ? <p className="mt-2 text-xs text-[var(--text-muted)]">{label.reason}</p> : null}
            </div>
          )) : (
            <p className="text-sm text-[var(--text-muted)]">No human labels yet.</p>
          )}
        </div>
      </GlassCard>
    </div>
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
    { id: "calibration", label: "Improve Scoring", icon: Brain },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-8 rounded-[1.45rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-6 shadow-sm">
        <p className="enterprise-kicker">Setup</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Set up the workspace without hunting for settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Connect assistants, teach the scorer, manage alerts, and keep the workspace healthy from one place.
        </p>
      </div>

      <div className="space-y-6">
        <div className="sticky top-4 z-20 -mx-1 overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-2 rounded-[1.2rem] border border-[var(--border-subtle)] bg-[var(--panel)] p-2 shadow-sm sm:min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 whitespace-nowrap px-3 py-2 rounded-xl text-sm transition-all ${
                  activeTab === tab.id
                    ? "bg-[var(--surface)] text-[var(--text-primary)] font-medium shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
          </div>
        </div>

        <div>
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "team" && <TeamTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
          {activeTab === "calibration" && <CalibrationTab />}
          {activeTab === "billing" && <BillingTab />}
        </div>
      </div>
    </div>
  );
}
