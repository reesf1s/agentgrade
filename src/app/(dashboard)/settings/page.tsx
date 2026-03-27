"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  Plug, Bell, Users, CreditCard, BookOpen, Trash2, Copy, Check,
  RefreshCw, Plus, Upload, ExternalLink, Zap,
} from "lucide-react";

// ─── Sub-types ────────────────────────────────────────────────────────────────
interface Connection {
  id: string; platform: string; name: string;
  is_active: boolean; last_sync_at?: string; webhook_url?: string;
}

interface AlertConfig {
  dimension: string; threshold: number; enabled: boolean;
}

interface TeamMember {
  id: string; clerk_user_id: string; role: string;
  email?: string; created_at: string;
}

interface BillingInfo {
  plan: string; price: string; usage: number; limit: number | null;
  stripe_customer_id?: string;
}

// ─── Tab identifiers ──────────────────────────────────────────────────────────
const TABS = [
  { id: "connections", label: "Connections",  icon: Plug },
  { id: "alerts",      label: "Alerts",       icon: Bell },
  { id: "team",        label: "Team",         icon: Users },
  { id: "knowledge",   label: "Knowledge",    icon: BookOpen },
  { id: "billing",     label: "Billing",      icon: CreditCard },
];

// ─── Utility: copy to clipboard ───────────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }
  return { copied, copy };
}

// ─── Connections Tab ──────────────────────────────────────────────────────────
function ConnectionsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const { success, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://agentgrade.com";

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/connections")
      .then((r) => r.json())
      .then((d) => setConnections(d.connections || []))
      .catch(() => showError("Failed to load connections"))
      .finally(() => setLoading(false));
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  async function syncNow(id: string) {
    setSyncing(id);
    // Trigger sync — in production this would call an integration sync endpoint
    await new Promise((r) => setTimeout(r, 1500));
    setSyncing(null);
    success("Sync triggered. New conversations will appear shortly.");
  }

  const platformLabel = (p: string) => ({
    intercom: "Intercom", zendesk: "Zendesk", freshdesk: "Freshdesk",
    custom: "Custom Webhook", csv: "CSV Upload",
  }[p] ?? p);

  return (
    <div className="space-y-4">
      {/* Existing connections */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agent Connections</h2>
          <button onClick={load} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : connections.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-4">
            No connections yet. Add one below to start ingesting conversations.
          </p>
        ) : (
          <div className="space-y-2 mb-6">
            {connections.map((conn) => (
              <div key={conn.id} className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {platformLabel(conn.platform)} — {conn.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {conn.is_active ? "Active" : "Inactive"}
                      {conn.last_sync_at && ` · Last sync: ${new Date(conn.last_sync_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${conn.is_active ? "bg-[#10B981]" : "bg-[var(--text-muted)]"}`} />
                    <GlassButton
                      size="sm"
                      onClick={() => syncNow(conn.id)}
                      disabled={syncing === conn.id}
                      className="flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncing === conn.id ? "animate-spin" : ""}`} />
                      {syncing === conn.id ? "Syncing…" : "Sync"}
                    </GlassButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new connection */}
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Add new connection</h3>
        <div className="grid grid-cols-3 gap-2">
          {["Intercom", "Zendesk", "Freshdesk"].map((p) => (
            <button
              key={p}
              onClick={() => window.location.href = "/onboarding"}
              className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-center"
            >
              <p className="text-sm font-medium text-[var(--text-primary)]">{p}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Connect</p>
            </button>
          ))}
          <button
            onClick={() => window.location.href = "/onboarding"}
            className="p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-center"
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">Custom</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Webhook / SDK</p>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="col-span-2 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-dashed border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] transition-colors text-center flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4 text-[var(--text-muted)]" />
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Upload CSV / JSON</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Supports any conversation format</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" />
        </div>
      </GlassCard>

      {/* Webhook URL display */}
      {connections.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Webhook URL</h2>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Use this URL to send conversations from any platform or custom agent.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={`${appUrl}/api/webhooks/ingest`}
              className="glass-input flex-1 px-3 py-2 text-xs font-mono"
            />
            <GlassButton
              size="sm"
              onClick={() => copy(`${appUrl}/api/webhooks/ingest`, "webhook")}
              className="flex items-center gap-1.5"
            >
              {copied === "webhook" ? <Check className="w-3.5 h-3.5 score-good" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "webhook" ? "Copied!" : "Copy"}
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab() {
  const { success, error: showError } = useToast();
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [email, setEmail] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const DEFAULT_THRESHOLDS = [
    { dimension: "overall",       label: "Overall Quality",   default: 70, desc: "Alert when overall score drops below" },
    { dimension: "accuracy",      label: "Accuracy",          default: 65, desc: "Alert when accuracy drops below" },
    { dimension: "hallucination", label: "Hallucination Rate", default: 5,  desc: "Alert when hallucination rate exceeds" },
    { dimension: "escalation",    label: "Escalation Rate",   default: 15, desc: "Alert when escalation rate exceeds" },
  ];

  useEffect(() => {
    fetch("/api/alerts/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.configs?.length) setConfigs(d.configs);
        else setConfigs(DEFAULT_THRESHOLDS.map((t) => ({ dimension: t.dimension, threshold: t.default, enabled: true })));
      })
      .catch(() => {
        setConfigs(DEFAULT_THRESHOLDS.map((t) => ({ dimension: t.dimension, threshold: t.default, enabled: true })));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getThreshold(dim: string, defaultVal: number) {
    const cfg = configs.find((c) => c.dimension === dim);
    return cfg ? (cfg.threshold > 1 ? cfg.threshold : Math.round(cfg.threshold * 100)) : defaultVal;
  }

  function setThreshold(dim: string, value: number) {
    setConfigs((prev) => {
      const existing = prev.find((c) => c.dimension === dim);
      if (existing) return prev.map((c) => c.dimension === dim ? { ...c, threshold: value } : c);
      return [...prev, { dimension: dim, threshold: value, enabled: true }];
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholds: configs.map((c) => ({ dimension: c.dimension, threshold: c.threshold, enabled: c.enabled })),
          notification_email: email || undefined,
        }),
      });
      if (res.ok) success("Alert thresholds saved.");
      else showError("Failed to save thresholds.");
    } catch {
      showError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Alert Thresholds</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Get notified when quality drops below these thresholds.
      </p>

      <div className="space-y-5 mb-6">
        {DEFAULT_THRESHOLDS.map((t) => {
          const val = getThreshold(t.dimension, t.default);
          return (
            <div key={t.dimension}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{t.label}</p>
                  <p className="text-xs text-[var(--text-muted)]">{t.desc}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={val}
                    onChange={(e) => setThreshold(t.dimension, parseInt(e.target.value) || 0)}
                    className="glass-input w-16 px-2 py-1 text-sm text-center font-mono"
                  />
                  <span className="text-xs text-[var(--text-muted)]">%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--divider)] pt-5 mb-5 space-y-3">
        <h3 className="text-xs font-medium text-[var(--text-secondary)]">Notification channels</h3>
        <GlassInput
          label="Email"
          placeholder="alerts@yourcompany.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <GlassInput
          label="Slack webhook URL (optional)"
          placeholder="https://hooks.slack.com/services/..."
          value={slackWebhook}
          onChange={(e) => setSlackWebhook(e.target.value)}
        />
      </div>

      <GlassButton variant="primary" onClick={save} disabled={saving} className="flex items-center gap-2">
        {saving ? "Saving…" : "Save thresholds"}
      </GlassButton>
    </GlassCard>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────
function TeamTab() {
  const { success, error: showError } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function invite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: "member" }),
      });
      const d = await res.json();
      if (res.ok) {
        success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
      } else {
        showError(d.error ?? "Failed to invite member");
      }
    } catch {
      showError("Network error — please try again");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(id: string) {
    setRemoving(id);
    try {
      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: id }),
      });
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        success("Member removed.");
      } else {
        const d = await res.json();
        showError(d.error ?? "Failed to remove member");
      }
    } catch {
      showError("Network error — please try again");
    } finally {
      setRemoving(null);
    }
  }

  const roleColor = (role: string) => ({
    owner: "score-good", admin: "score-warning", member: "text-[var(--text-muted)]",
  }[role] ?? "text-[var(--text-muted)]");

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Team Members</h2>

      {loading ? (
        <div className="space-y-2 mb-6">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {members.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-2">No team members found.</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.02)]"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {m.email || m.clerk_user_id.slice(0, 16) + "…"}
                  </p>
                  <span className={`text-xs font-medium capitalize ${roleColor(m.role)}`}>
                    {m.role}
                  </span>
                </div>
                {m.role !== "owner" && (
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={removing === m.id}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#EF4444] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="border-t border-[var(--divider)] pt-5">
        <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Invite team member</h3>
        <div className="flex gap-2">
          <GlassInput
            placeholder="Email address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="flex-1"
          />
          <GlassButton
            onClick={invite}
            disabled={inviting || !inviteEmail.trim()}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {inviting ? "Inviting…" : "Invite"}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Knowledge Tab ────────────────────────────────────────────────────────────
function KnowledgeTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files] = useState([
    { name: "refund-policy.pdf",  chunks: 12, uploaded: "Mar 20" },
    { name: "product-faq.txt",    chunks: 8,  uploaded: "Mar 18" },
  ]);

  return (
    <GlassCard className="p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Knowledge Base</h2>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Upload help docs, FAQs, and policies. Used to verify agent accuracy and detect hallucinations.
      </p>

      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden" />
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[rgba(255,255,255,0.08)] rounded-xl p-8 text-center hover:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer mb-4"
      >
        <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files here</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Files are chunked and embedded for semantic search</p>
        <GlassButton size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          Choose files
        </GlassButton>
      </div>

      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[rgba(255,255,255,0.02)]">
            <div>
              <p className="text-sm text-[var(--text-primary)]">{f.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{f.chunks} chunks · Uploaded {f.uploaded}</p>
            </div>
            <button className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#EF4444] transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab() {
  const { success, error: showError } = useToast();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => r.json())
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function upgrade(plan: string) {
    setUpgrading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url;
      } else {
        showError(d.error ?? "Failed to start checkout");
      }
    } catch {
      showError("Network error — please try again");
    } finally {
      setUpgrading(null);
    }
  }

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const d = await res.json();
      if (res.ok && d.url) {
        window.location.href = d.url;
      } else {
        showError(d.error ?? "Could not open billing portal");
      }
    } catch {
      showError("Network error — please try again");
    } finally {
      setOpeningPortal(false);
    }
  }

  const usagePct = billing?.limit ? (billing.usage / billing.limit) * 100 : 0;

  const PLANS = [
    {
      id: "starter", name: "Starter", price: "£199", period: "/mo",
      features: ["5,000 conversations/month", "1 agent connection", "Weekly reports", "Email alerts"],
    },
    {
      id: "growth", name: "Growth", price: "£499", period: "/mo", featured: true,
      features: ["25,000 conversations/month", "Unlimited connections", "Benchmark dashboard", "Slack/Teams alerts", "Priority support"],
    },
    {
      id: "enterprise", name: "Enterprise", price: "Custom", period: "",
      features: ["Unlimited conversations", "Custom scoring", "API access", "SLA", "SSO"],
    },
  ];

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <GlassCard className="p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Current Plan</h2>
        <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)] capitalize">
                {billing?.plan ?? "Starter"} Plan
              </p>
              <p className="text-xs text-[var(--text-muted)]">{billing?.price ?? "£199/mo"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </div>
          {billing?.limit && (
            <>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[var(--text-secondary)]">Usage this month</span>
                <span className="text-[var(--text-primary)] font-mono">
                  {billing.usage.toLocaleString()} / {billing.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePct > 90 ? "bg-[#EF4444]" : usagePct > 70 ? "bg-[#F59E0B]" : "bg-[#10B981]"
                  }`}
                  style={{ width: `${Math.min(100, usagePct)}%` }}
                />
              </div>
            </>
          )}
        </div>

        {billing?.stripe_customer_id && (
          <GlassButton
            onClick={openPortal}
            disabled={openingPortal}
            className="flex items-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {openingPortal ? "Opening…" : "Manage billing"}
          </GlassButton>
        )}
      </GlassCard>

      {/* Plan upgrade cards */}
      <div className="grid grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = billing?.plan === plan.id;
          return (
            <GlassCard
              key={plan.id}
              className={`p-5 ${plan.featured ? "border-[rgba(255,255,255,0.1)]" : ""}`}
            >
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{plan.name}</h3>
              <div className="flex items-baseline gap-0.5 mb-4">
                <span className="text-2xl font-bold font-mono text-[var(--text-primary)]">{plan.price}</span>
                <span className="text-xs text-[var(--text-muted)]">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                    <Check className="w-3.5 h-3.5 mt-0.5 text-[var(--text-muted)] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="text-center text-xs text-[var(--text-muted)] py-2 rounded-xl bg-[rgba(255,255,255,0.02)]">
                  Current plan
                </div>
              ) : plan.id === "enterprise" ? (
                <GlassButton size="sm" className="w-full text-center">
                  Contact sales
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => upgrade(plan.id)}
                  disabled={upgrading === plan.id}
                >
                  {upgrading === plan.id ? "Loading…" : "Upgrade"}
                </GlassButton>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams?.get("tab") ?? "connections");

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Settings</h1>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-44 flex-shrink-0 space-y-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                  activeTab === tab.id
                    ? "bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {activeTab === "connections" && <ConnectionsTab />}
          {activeTab === "alerts"      && <AlertsTab />}
          {activeTab === "team"        && <TeamTab />}
          {activeTab === "knowledge"   && <KnowledgeTab />}
          {activeTab === "billing"     && <BillingTab />}
        </div>
      </div>
    </div>
  );
}
