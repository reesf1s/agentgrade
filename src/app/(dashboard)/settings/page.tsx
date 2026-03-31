"use client";
import { useEffect, useRef, useState } from "react";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/ui/glass-input";
import { Plug, Bell, Users, BookOpen, Trash2, Copy, Check, RefreshCw, Brain } from "lucide-react";

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
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
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
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [setupLoading, setSetupLoading] = useState<string | null>(null);
  const [expandedConnectionId, setExpandedConnectionId] = useState<string | null>(null);
  const [setupByConnection, setSetupByConnection] = useState<Record<string, ConnectionSetupDetails>>({});
  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/ingest`
    : "/api/webhooks/ingest";

  function loadConnections() {
    setLoadError(false);
    fetch("/api/connections")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setConnections(d.connections || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadConnections(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncConnection(id: string) {
    setSyncing(id);
    try {
      await fetch(`/api/connections/${id}/sync`, { method: "POST" });
      const r = await fetch("/api/connections");
      if (r.ok) {
        const d = await r.json();
        setConnections(d.connections || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(null);
    }
  }

  async function deleteConnection(id: string) {
    setDeleting(id);
    setConfirmDeleteId(null);
    try {
      const r = await fetch(`/api/connections/${id}`, { method: "DELETE" });
      if (r.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
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
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="page-eyebrow">Connections</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#37352F]">Setup</h2>
          </div>
          <div className="rounded-full border border-[#E9E9E7] bg-[#F7F7F5] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[#ACABA8]">
            5 minutes
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span className="operator-chip">✓ Conversations connected</span>
          <span className="operator-chip">✓ Scoring active</span>
          <span className="operator-chip">– Alerts optional</span>
          <span className="operator-chip">▼ Advanced</span>
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
              className="rounded-[6px] border border-[#E9E9E7] bg-white p-4 text-left transition-colors hover:bg-[#F7F7F5]"
              onClick={() => {
                window.location.href = `/onboarding?platform=${option.platform}`;
              }}
            >
              <p className="text-sm font-medium text-[#37352F]">{option.label}</p>
              <p className="mt-1 text-xs text-[#787774]">Connect</p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">Webhook endpoint</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={webhookUrl}
                className="glass-input flex-1 px-3 py-2 text-xs font-mono"
              />
              <button className="glass-button" onClick={copyWebhook}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/onboarding?platform=csv";
            }}
            className="rounded-[6px] border-2 border-dashed border-[#E9E9E7] p-5 text-left transition-colors hover:border-[#D0D0CD]"
          >
            <p className="text-sm font-medium text-[#37352F]">Upload past conversations</p>
            <p className="mt-2 text-xs leading-5 text-[#787774]">CSV or JSON</p>
          </button>
        </div>
      </div>

      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h2 className="text-sm font-semibold text-[#37352F] mb-4">Connected assistants</h2>
        {loading ? (
          <p className="text-sm text-[#ACABA8]">Loading connections...</p>
        ) : loadError ? (
          <div className="py-6 text-center">
            <p className="text-sm text-[#787774]">Could not load connections.</p>
            <button className="glass-button mt-3" onClick={loadConnections}>Retry</button>
          </div>
        ) : connections.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#ACABA8]">
            No live assistants connected yet. Use one of the setup options above to get started.
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {connections.map((conn) => (
              <div key={conn.id} className="rounded-[6px] border border-[#E9E9E7] bg-white p-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#37352F]">{conn.name}</p>
                    <p className="text-xs text-[#ACABA8] mt-0.5 capitalize">
                      {conn.platform} &middot; {conn.is_active ? "Active" : "Inactive"}
                      {conn.last_sync_at ? ` · Last sync: ${new Date(conn.last_sync_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[rgba(15,123,61,0.2)] bg-[rgba(15,123,61,0.08)] px-2 py-0.5 text-[11px] font-medium text-[#0F7B3D]">
                        Active
                      </span>
                    )}
                    <button className="glass-button" onClick={() => loadSetup(conn.id)}>
                      {setupLoading === conn.id
                        ? "Loading..."
                        : expandedConnectionId === conn.id
                          ? "Hide setup"
                          : "Setup"}
                    </button>
                    <button
                      className="glass-button"
                      onClick={() => syncConnection(conn.id)}
                      disabled={syncing === conn.id}
                    >
                      {syncing === conn.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        "Sync now"
                      )}
                    </button>
                    {confirmDeleteId === conn.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[#787774]">Remove?</span>
                        <button
                          className="glass-button"
                          disabled={deleting === conn.id}
                          onClick={() => deleteConnection(conn.id)}
                        >
                          Yes
                        </button>
                        <button className="glass-button" onClick={() => setConfirmDeleteId(null)}>
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(conn.id)}
                        className="text-[#ACABA8] hover:text-[#C4342C] transition-colors"
                        aria-label="Remove connection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {expandedConnectionId === conn.id && setupByConnection[conn.id] && (
                  <div className="mt-4 space-y-4 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-5">
                    <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">
                        Integration steps
                      </p>
                      <ol className="mt-3 space-y-2 text-sm text-[#787774]">
                        {setupByConnection[conn.id].install_steps.map((step, index) => (
                          <li key={step} className="flex gap-3">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1F1EF] text-[11px] font-semibold text-[#37352F]">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#37352F] mb-1">Webhook endpoint</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={setupByConnection[conn.id].webhook_url}
                          className="glass-input flex-1 px-3 py-2 text-xs font-mono"
                        />
                        <button className="glass-button" onClick={() => copyText(setupByConnection[conn.id].webhook_url)}>
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#37352F] mb-1">Bearer secret</p>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={setupByConnection[conn.id].api_key}
                          className="glass-input flex-1 px-3 py-2 text-xs font-mono"
                        />
                        <button className="glass-button" onClick={() => copyText(setupByConnection[conn.id].api_key)}>
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-[#ACABA8]">
                        Send every transcript update with `Authorization: Bearer &lt;secret&gt;`. Re-sending the same `conversation_id` now appends new messages and re-scores instead of being ignored.
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs font-medium text-[#37352F]">Env vars for your app</p>
                        <button className="glass-button" onClick={() => copyText(setupByConnection[conn.id].env_example)}>
                          Copy env vars
                        </button>
                      </div>
                      <pre className="bg-[#F7F7F5] border border-[#E9E9E7] text-[#37352F] font-mono text-xs rounded-[6px] p-4 overflow-x-auto">
                        {setupByConnection[conn.id].env_example}
                      </pre>
                      <div className="mt-2 space-y-1 text-xs text-[#ACABA8]">
                        {Object.entries(setupByConnection[conn.id].env_help).map(([key, value]) => (
                          <p key={key}>
                            <span className="font-mono text-[#37352F]">{key}</span>: {value}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-[#37352F] mb-1">Quick test</p>
                      <pre className="bg-[#F7F7F5] border border-[#E9E9E7] text-[#37352F] font-mono text-xs rounded-[6px] p-4 overflow-x-auto">
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
                        <p className="text-xs font-medium text-[#37352F]">JavaScript snippet</p>
                        <button className="glass-button" onClick={() => copyText(setupByConnection[conn.id].snippet)}>
                          Copy snippet
                        </button>
                      </div>
                      <pre className="bg-[#F7F7F5] border border-[#E9E9E7] text-[#37352F] font-mono text-xs rounded-[6px] p-4 overflow-x-auto">
                        {setupByConnection[conn.id].snippet}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  function loadThresholds() {
    setLoadError(false);
    fetch("/api/alerts/config")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const map: Record<string, number> = {};
        for (const cfg of d.configs || []) {
          map[cfg.dimension] = Math.round((cfg.threshold ?? 0) * 100);
        }
        setConfigs(map);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadThresholds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveThresholds() {
    setSaving(true);
    setSaveError(false);
    try {
      const r = await fetch("/api/alerts/config", {
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
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <h2 className="text-sm font-semibold text-[#37352F] mb-4">Alert Thresholds</h2>
      <p className="text-xs text-[#ACABA8] mb-6">Get notified when quality drops below these thresholds.</p>
      {loading ? (
        <p className="text-sm text-[#ACABA8]">Loading...</p>
      ) : loadError ? (
        <div className="py-4 text-center">
          <p className="text-sm text-[#787774]">Could not load alert thresholds.</p>
          <button className="glass-button mt-3" onClick={loadThresholds}>Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          {THRESHOLD_DIMS.map(({ dim, label }) => (
            <div key={dim} className="flex items-center justify-between">
              <span className="text-sm text-[#37352F]">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#ACABA8]">Alert below</span>
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
                <span className="text-xs text-[#ACABA8]">%</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {saveError && (
        <p className="mt-3 text-xs text-[#C4342C]">Failed to save thresholds. Try again.</p>
      )}
      <button className="glass-button mt-3" onClick={saveThresholds} disabled={saving || loading || loadError}>
        {saved ? "Saved!" : saving ? "Saving..." : "Save thresholds"}
      </button>
    </div>
  );
}

// ─── Tab: Team ────────────────────────────────────────────────────────────────

function TeamTab() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function loadTeam() {
    setLoadError(false);
    fetch("/api/team")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setMembers(d.members || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadTeam(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <h2 className="text-sm font-semibold text-[#37352F] mb-4">Team Members</h2>
      {loading ? (
        <p className="text-sm text-[#ACABA8]">Loading...</p>
      ) : loadError ? (
        <div className="py-4 text-center mb-4">
          <p className="text-sm text-[#787774]">Could not load team members.</p>
          <button className="glass-button mt-3" onClick={loadTeam}>Retry</button>
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-[#ACABA8] mb-6">No team members yet.</p>
      ) : (
        <div className="space-y-3 mb-6">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-[6px] border border-[#E9E9E7] bg-white p-3 hover:bg-[#F7F7F5] transition-colors">
              <div>
                <p className="text-sm font-medium text-[#37352F]">
                  {m.email || m.clerk_user_id}
                </p>
                <p className="text-xs text-[#ACABA8] capitalize">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {inviteError && (
        <p className="text-xs text-[#C4342C] mb-3">{inviteError}</p>
      )}
      <div className="flex gap-2">
        <GlassInput
          placeholder="Email address"
          className="flex-1"
          value={inviteEmail}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)}
        />
        <button className="glass-button" onClick={invite} disabled={inviting || !inviteEmail}>
          {inviting ? "Inviting..." : "Invite"}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Knowledge Base ──────────────────────────────────────────────────────

function KnowledgeTab() {
  const [sources, setSources] = useState<KBSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmDeleteKbId, setConfirmDeleteKbId] = useState<string | null>(null);
  const [deletingKb, setDeletingKb] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [syncingUrl, setSyncingUrl] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function loadSources() {
    setLoadError(false);
    fetch("/api/knowledge-base")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setSources(d.sources || []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSources(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteSource(id: string) {
    setDeletingKb(id);
    setConfirmDeleteKbId(null);
    try {
      const r = await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
      if (r.ok) {
        setSources((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingKb(null);
    }
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
    <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <h2 className="text-sm font-semibold text-[#37352F] mb-2">Knowledge Base</h2>
      <p className="text-xs text-[#ACABA8] mb-6">
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
        className="mb-4 w-full rounded-[6px] border-2 border-dashed border-[#E9E9E7] p-8 text-center transition-colors hover:border-[#D0D0CD] hover:bg-[#F7F7F5]"
      >
        <BookOpen className="w-8 h-8 text-[#ACABA8] mx-auto mb-2" />
        <p className="text-sm text-[#787774]">
          {uploadingFile ? "Uploading knowledge file..." : "Upload PDF, DOCX, TXT, Markdown, or JSON"}
        </p>
        <p className="text-xs text-[#ACABA8] mt-1">Files are chunked and embedded for semantic search</p>
      </button>
      <div className="mb-4 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
        <p className="text-xs font-medium text-[#37352F] mb-3">Or import a help center URL</p>
        <div className="flex gap-2">
          <GlassInput
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://help.example.com/article"
            className="flex-1"
          />
          <button className="glass-button" onClick={ingestUrl} disabled={!sourceUrl || syncingUrl}>
            {syncingUrl ? "Importing..." : "Import URL"}
          </button>
        </div>
        {urlError ? <p className="mt-2 text-xs text-[#C4342C]">{urlError}</p> : null}
      </div>
      <div className="mb-4 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
        <p className="text-xs font-medium text-[#37352F] mb-3">Sync from a connected help center</p>
        <div className="flex flex-wrap gap-2">
          <button
            className="glass-button"
            onClick={() => syncHelpCenter("intercom")}
            disabled={syncingPlatform !== null}
          >
            {syncingPlatform === "intercom" ? "Syncing Intercom..." : "Sync Intercom Articles"}
          </button>
          <button
            className="glass-button"
            onClick={() => syncHelpCenter("zendesk")}
            disabled={syncingPlatform !== null}
          >
            {syncingPlatform === "zendesk" ? "Syncing Zendesk..." : "Sync Zendesk Help Center"}
          </button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-[#ACABA8]">Loading...</p>
      ) : loadError ? (
        <div className="py-4 text-center">
          <p className="text-sm text-[#787774]">Could not load knowledge base.</p>
          <button className="glass-button mt-3" onClick={loadSources}>Retry</button>
        </div>
      ) : sources.length === 0 ? (
        <div className="py-4 text-center text-sm text-[#ACABA8]">
          No knowledge base items yet. Upload documents to improve accuracy scoring.
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-[6px] border border-[#E9E9E7] bg-white p-3 hover:bg-[#F7F7F5] transition-colors border-b border-[#F1F1EF]">
              <div>
                <p className="text-sm font-medium text-[#37352F]">{s.source}</p>
                <p className="text-xs text-[#ACABA8]">
                  {s.chunks} chunk{s.chunks !== 1 ? "s" : ""} · Uploaded {new Date(s.created_at).toLocaleDateString()}
                </p>
              </div>
              {confirmDeleteKbId === s.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#787774]">Delete?</span>
                  <button className="glass-button" disabled={deletingKb === s.id} onClick={() => deleteSource(s.id)}>Yes</button>
                  <button className="glass-button" onClick={() => setConfirmDeleteKbId(null)}>No</button>
                </div>
              ) : (
                <button
                  className="text-[#ACABA8] hover:text-[#C4342C] transition-colors"
                  onClick={() => setConfirmDeleteKbId(s.id)}
                  aria-label="Delete knowledge base item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

const PLANS = [
  { key: "starter", name: "Starter", price: "£199/mo", conversations: "5,000", current: false },
  { key: "growth", name: "Growth", price: "£499/mo", conversations: "25,000", current: false },
  { key: "enterprise", name: "Enterprise", price: "£999/mo", conversations: "Unlimited", current: false },
] as const;

function BillingTab() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function loadBilling() {
    setLoadError(false);
    fetch("/api/billing")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setBilling(d))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // Check URL for success/cancel params
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setSuccessMsg("Your subscription has been updated. Changes may take a moment to reflect.");
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
    }
    loadBilling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function openCheckout(plan: string) {
    setBillingError(null);
    setCheckoutPlan(plan);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
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
    } finally {
      setCheckoutPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p className="text-sm text-[#ACABA8]">Loading billing...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p className="text-sm text-[#787774]">Could not load billing information.</p>
        <button className="glass-button mt-3" onClick={loadBilling}>Retry</button>
      </div>
    );
  }

  const usagePct = billing?.limit
    ? Math.min(100, ((billing.usage ?? 0) / billing.limit) * 100)
    : 0;

  const currentPlan = billing?.plan ?? "starter";

  return (
    <div className="space-y-4">
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h2 className="text-sm font-semibold text-[#37352F] mb-4">Billing</h2>

        {successMsg && (
          <div className="mb-4 rounded-[6px] border border-[rgba(15,123,61,0.2)] bg-[rgba(15,123,61,0.08)] p-4 text-sm text-[#0F7B3D]">
            {successMsg}
          </div>
        )}

        {!billing?.configured && (
          <div className="mb-4 rounded-[6px] border border-[rgba(196,122,0,0.2)] bg-[rgba(196,122,0,0.08)] p-4 text-sm text-[#C47A00]">
            Stripe is not configured yet. Checkout and portal are unavailable until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set in Vercel environment variables.
          </div>
        )}

        {billingError && (
          <div className="mb-4 rounded-[6px] border border-[rgba(196,52,44,0.2)] bg-[rgba(196,52,44,0.08)] p-4 text-sm text-[#C4342C]">
            {billingError}
          </div>
        )}

        {billing ? (
          <>
            {/* Current plan + usage */}
            <div className="mb-6 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-[#37352F] capitalize">{currentPlan} Plan</p>
                  <p className="text-xs text-[#787774]">
                    {billing.price} &middot; {billing.limit ? billing.limit.toLocaleString() : "Unlimited"} conversations/mo
                  </p>
                </div>
                {billing.stripe_subscription_id && (
                  <button className="glass-button" onClick={openPortal} disabled={portalLoading || !billing.configured}>
                    {portalLoading ? "Opening..." : "Manage billing"}
                  </button>
                )}
              </div>
              {billing.limit && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#787774]">Usage this month</span>
                    <span className="text-[#37352F] font-mono">
                      {(billing.usage ?? 0).toLocaleString()} / {billing.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#E9E9E7]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${usagePct}%`,
                        backgroundColor: usagePct > 90 ? "#C4342C" : usagePct > 75 ? "#C47A00" : "#2383E2",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Plan picker */}
            <h3 className="text-xs font-medium text-[#787774] uppercase tracking-wider mb-3">
              {currentPlan === "starter" ? "Choose a plan" : "Available plans"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PLANS.map((p) => {
                const isCurrent = currentPlan === p.key;
                const isDowngrade = PLANS.findIndex((x) => x.key === currentPlan) >= PLANS.findIndex((x) => x.key === p.key);
                return (
                  <div
                    key={p.key}
                    className={`rounded-[6px] border p-4 transition-all ${
                      isCurrent
                        ? "border-[#2383E2] bg-[rgba(35,131,226,0.04)]"
                        : "border-[#E9E9E7] bg-white hover:bg-[#F7F7F5]"
                    }`}
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-[#37352F]">{p.name}</p>
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wider text-[#787774] border border-[#E9E9E7] rounded-[4px] px-1.5 py-0.5 bg-[#F7F7F5]">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-[#37352F] font-mono">{p.price}</p>
                    <p className="text-xs text-[#ACABA8] mt-1">{p.conversations} conversations/mo</p>
                    {!isCurrent && !isDowngrade && (
                      <button
                        className="glass-button glass-button-primary mt-3 w-full"
                        onClick={() => openCheckout(p.key)}
                        disabled={!billing.configured || checkoutPlan !== null}
                      >
                        {checkoutPlan === p.key ? "Redirecting..." : "Upgrade"}
                      </button>
                    )}
                    {!isCurrent && isDowngrade && billing.stripe_subscription_id && (
                      <button
                        className="glass-button mt-3 w-full"
                        onClick={openPortal}
                        disabled={!billing.configured || portalLoading}
                      >
                        Downgrade via portal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-[#ACABA8]">Unable to load billing information.</p>
        )}
      </div>
    </div>
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
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p className="text-sm text-[#ACABA8]">Loading calibration tools...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#ACABA8]">Training</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#37352F]">
              Improve scoring with examples your team agrees on
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#787774]">
              Add real or synthetic conversations, label them once, and AgentGrade uses those labels to calibrate scoring over time.
            </p>
          </div>
          <div className="rounded-full border border-[#E9E9E7] bg-[#F7F7F5] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[#ACABA8]">
            {data?.scorer.training_stage.label}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">Human labels</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#37352F]">
              {data?.scorer.labeled_examples || 0}
            </p>
            <p className="mt-1 text-xs text-[#787774]">Across private and shared training sets</p>
          </div>
          <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">Workspace learning</p>
            <p className="mt-2 text-sm font-semibold text-[#37352F]">
              {data?.scorer.learned_calibration.workspace_model.active ? "Active" : "Warming up"}
            </p>
            <p className="mt-1 text-xs text-[#787774]">
              {data?.scorer.learned_calibration.workspace_private_labels || 0} private labels in this workspace
            </p>
          </div>
          <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">Scorer</p>
            <p className="mt-2 text-sm font-semibold text-[#37352F]">
              {data?.scorer.evaluator_provider} / {data?.scorer.evaluator_model}
            </p>
            <p className="mt-1 text-xs text-[#787774]">
              Version {data?.scorer.scoring_model_version}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div id="training-example-form" className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[#37352F]">Create a training example</h2>
              <p className="mt-2 text-sm leading-6 text-[#787774]">
                Paste a transcript, add the scores a human would give it, and save it as a gold-set example.
              </p>
            </div>
            <div className="rounded-full border border-[#E9E9E7] bg-[#F7F7F5] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-[#ACABA8]">
              {exampleKind === "synthetic" ? "Synthetic" : "Real"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
            <GlassInput
              label="Example title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Crestline deal briefing without trace data"
            />
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
                <p className="mb-1 text-xs text-[#787774]">{dimension.label}</p>
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

          <details className="mt-4 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#37352F]">
              Add reviewer notes and sharing details
            </summary>
            <GlassTextarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-4 min-h-[96px]"
              placeholder="Explain the correct judgment. Capture groundedness, user intent, escalation quality, and any org context."
            />
            <p className="mt-3 text-xs leading-5 text-[#ACABA8]">
              Shared learning uses anonymized score features plus your labels. Raw transcript text stays private.
            </p>
          </details>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#ACABA8]">
              {data?.scorer.calibration_note}
            </p>
            <button className="glass-button sm:min-w-[220px]" onClick={submitCalibrationExample} disabled={saving}>
              {saving ? "Saving..." : "Save training example"}
            </button>
          </div>
          {state === "saved" ? <p className="mt-3 text-xs text-[#0F7B3D]">Training example saved.</p> : null}
          {state === "error" ? <p className="mt-3 text-xs text-[#C4342C]">Failed to save training example.</p> : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h2 className="text-sm font-semibold text-[#37352F]">Where to focus next</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">Next private milestone</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#37352F]">
                  {data?.scorer.training_insights.roadmap.next_workspace_label_milestone || 30}
                </p>
                <p className="mt-1 text-xs text-[#787774]">Private labels needed to strengthen the workspace scorer</p>
              </div>
              <div className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ACABA8]">Best next steps</p>
                <div className="mt-3 space-y-2">
                  {data?.scorer.training_insights.roadmap.best_next_steps.map((step) => (
                    <p key={step} className="text-sm leading-6 text-[#787774]">• {step}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div id="review-queue" className="rounded-[6px] border border-[#E9E9E7] bg-white p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h2 className="text-sm font-semibold text-[#37352F]">Label real conversations next</h2>
            <p className="mt-2 text-sm leading-6 text-[#787774]">
              These are the highest-value conversations to review if you want the scorer to improve quickly.
            </p>
            <div className="mt-4 space-y-3">
              {data?.scorer.training_insights.review_queue.length ? data.scorer.training_insights.review_queue.map((item) => (
                <div key={item.conversation_id} className="rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#37352F]">
                        {item.customer_identifier || item.conversation_id}
                      </p>
                      <p className="mt-1 text-xs text-[#ACABA8] capitalize">
                        {item.platform || "custom"} · Score {(item.overall_score * 100).toFixed(0)}% · Confidence {item.confidence_level}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#787774]">{item.reason}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-[4px] bg-[#F7F7F5] border border-[#E9E9E7] px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[#ACABA8]">
                        Priority {item.priority_score.toFixed(2)}
                      </span>
                      <button className="glass-button" onClick={() => { window.location.href = `/conversations/${item.conversation_id}`; }}>
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-[#ACABA8]">No high-value unlabeled conversations right now.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <details className="group rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#37352F]">Model details and coverage</h2>
            <p className="mt-1 text-xs text-[#787774]">
              Open this when you want to inspect coverage, privacy, and how the scorer is currently built.
            </p>
          </div>
          <span className="rounded-full border border-[#E9E9E7] bg-[#F7F7F5] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#ACABA8] group-open:hidden">
            Expand
          </span>
        </summary>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">Coverage snapshot</p>
            <div className="mt-3 space-y-2 text-xs text-[#787774]">
              <p>Private examples: {data?.scorer.training_insights.label_coverage.private_examples || 0}</p>
              <p>Shared examples: {data?.scorer.training_insights.label_coverage.shared_examples || 0}</p>
              <p>Real examples: {data?.scorer.training_insights.label_coverage.real_examples || 0}</p>
              <p>Synthetic examples: {data?.scorer.training_insights.label_coverage.synthetic_examples || 0}</p>
            </div>
          </div>
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">Coverage by score dimension</p>
            <div className="mt-3 space-y-2">
              {data?.scorer.training_insights.label_coverage.dimensions.map((dimension) => (
                <div key={dimension.key} className="flex items-center justify-between text-xs">
                  <span className="text-[#787774]">{dimension.label}</span>
                  <span className={dimension.healthy ? "text-[#0F7B3D]" : "text-[#C47A00]"}>
                    {dimension.label_count} labels
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">What runs in production</p>
            <p className="mt-2 text-sm font-medium text-[#37352F]">
              {data?.scorer.model_card.base_evaluator.provider} / {data?.scorer.model_card.base_evaluator.model}
            </p>
            <div className="mt-3 space-y-2">
              {data?.scorer.model_card.strengths.map((item) => (
                <p key={item} className="text-xs leading-5 text-[#787774]">• {item}</p>
              ))}
            </div>
          </div>
          <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">Privacy posture</p>
            <div className="mt-3 space-y-2">
              <p className="text-xs leading-5 text-[#787774]">{data?.scorer.model_card.privacy.workspace_private}</p>
              <p className="text-xs leading-5 text-[#787774]">{data?.scorer.model_card.privacy.global_anonymous}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-[6px] border border-[#E9E9E7] bg-[#F7F7F5] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#ACABA8]">Roadmap to a proprietary scorer</p>
          <div className="mt-3 space-y-2">
            {data?.scorer.model_card.path_to_proprietary_model.map((item) => (
              <p key={item} className="text-xs leading-5 text-[#787774]">• {item}</p>
            ))}
          </div>
        </div>
      </details>

      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h2 className="mb-3 text-sm font-semibold text-[#37352F]">Recent training activity</h2>
        <div className="space-y-3">
          {data?.recent_labels?.length ? data.recent_labels.map((label) => (
            <div key={label.id} className="rounded-[6px] border border-[#E9E9E7] bg-white p-3 hover:bg-[#F7F7F5] transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#37352F]">{label.customer_identifier || label.conversation_id}</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-[4px] bg-[#F7F7F5] border border-[#E9E9E7] px-2 py-1 capitalize text-[#ACABA8]">{label.source}</span>
                  <span className="rounded-[4px] bg-[#F7F7F5] border border-[#E9E9E7] px-2 py-1 capitalize text-[#ACABA8]">{label.example_kind}</span>
                  <span className="rounded-[4px] bg-[#F7F7F5] border border-[#E9E9E7] px-2 py-1 text-[#ACABA8]">
                    {label.share_scope === "global_anonymous" ? "shared" : "private"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#787774]">
                {label.dimension} · {(label.override_score * 100).toFixed(0)}%
              </p>
              {label.reason ? <p className="mt-2 text-xs text-[#ACABA8]">{label.reason}</p> : null}
            </div>
          )) : (
            <p className="text-sm text-[#ACABA8]">No human labels yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <TeamTab />
      <BillingTab />
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "billing") return "workspace";
      if (tab && ["connections", "knowledge", "alerts", "calibration", "workspace"].includes(tab)) return tab;
    }
    return "connections";
  });

  const tabs = [
    {
      id: "connections",
      step: "01",
      label: "Connect data",
      description: "Recommended",
      icon: Plug,
    },
    {
      id: "knowledge",
      step: "02",
      label: "Add context",
      description: "Recommended",
      icon: BookOpen,
    },
    {
      id: "alerts",
      step: "03",
      label: "Alerts",
      description: "Optional",
      icon: Bell,
    },
    {
      id: "calibration",
      step: "04",
      label: "Training",
      description: "Optional",
      icon: Brain,
    },
    {
      id: "workspace",
      step: "05",
      label: "Workspace",
      description: "Advanced",
      icon: Users,
    },
  ];

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="space-y-6 pb-10 bg-white min-h-full">
      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4 sm:p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p className="page-eyebrow">Setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#37352F]">Setup checklist.</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {tabs.map((tab) => (
            <button
              key={`summary-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`operator-chip ${activeTab === tab.id ? "border-[#D0D0CD] bg-[#F1F1EF] text-[#37352F]" : ""}`}
            >
              {activeTab === tab.id ? "▼" : tab.id === "connections" || tab.id === "knowledge" ? "✓" : "–"} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#F7F7F5] border border-[#E9E9E7] rounded-[6px] p-1 flex gap-1 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[4px] px-4 py-2.5 text-left transition-all ${
                isActive
                  ? "bg-white border border-[#E9E9E7] text-[#37352F] font-medium shadow-sm"
                  : "text-[#787774] hover:text-[#37352F] hover:bg-[#EBEBEA]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-[4px] border border-[#E9E9E7] ${isActive ? "bg-white" : "bg-[#F1F1EF]"}`}>
                  <Icon className={`h-4 w-4 ${isActive ? "text-[#37352F]" : "text-[#787774]"}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isActive ? "text-[#37352F]" : "text-[#787774]"}`}>{tab.label}</p>
                  <p className="text-xs text-[#ACABA8]">{tab.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-[6px] border border-[#E9E9E7] bg-white p-4 sm:p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-semibold tracking-[-0.03em] text-[#37352F]">{activeTabConfig.label}</p>
          </div>
          <span className="operator-chip">{activeTabConfig.description}</span>
        </div>

        <div>
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "alerts" && <AlertsTab />}
          {activeTab === "knowledge" && <KnowledgeTab />}
          {activeTab === "calibration" && <CalibrationTab />}
          {activeTab === "workspace" && <WorkspaceTab />}
        </div>
      </div>
    </div>
  );
}
