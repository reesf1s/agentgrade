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

interface AlertConfig {
  id: string;
  dimension: string;
  threshold: number;
  enabled: boolean;
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
}

// ─── Tab: Connections ─────────────────────────────────────────────────────────

function ConnectionsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="space-y-4">
      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Agent Connections</h2>

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
              </div>
            ))}
          </div>
        )}

        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3 mt-2">Add new connection</h3>
        <div className="grid grid-cols-3 gap-3">
          {["Intercom", "Zendesk", "Custom Webhook"].map((platform) => (
            <button
              key={platform}
              className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.04)] transition-colors text-center"
              onClick={() => {
                window.location.href = "/onboarding";
              }}
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">{platform}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Connect</p>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Or upload conversations</h3>
          <div className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer">
            <p className="text-sm text-[var(--text-secondary)]">Drop CSV or JSON file here</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Supports any conversation format</p>
          </div>
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

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d) => setBilling(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
    } catch (e) {
      console.error(e);
    } finally {
      setPortalLoading(false);
    }
  }

  async function openCheckout() {
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "growth" }),
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
    } catch (e) {
      console.error(e);
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
          <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)] mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{billing.plan} Plan</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {billing.price} &middot; {billing.limit ? billing.limit.toLocaleString() : "Unlimited"} conversations
                </p>
              </div>
              {billing.plan !== "enterprise" && (
                <GlassButton size="sm" onClick={openCheckout}>Upgrade</GlassButton>
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
          <GlassButton onClick={openPortal} disabled={portalLoading}>
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
