"use client";
import { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  Building2, Plug, BookOpen, Bell, CheckCircle2,
  ArrowRight, Upload, AlertCircle, Copy, Check,
  Code2, Globe, Webhook, MessageSquare, ChevronRight
} from "lucide-react";

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, title: "Name workspace",   icon: Building2 },
  { id: 2, title: "Connect agent",    icon: Plug },
  { id: 3, title: "Knowledge base",  icon: BookOpen },
  { id: 4, title: "Alert thresholds", icon: Bell },
  { id: 5, title: "All set!",         icon: CheckCircle2 },
];

const ALERT_THRESHOLDS = [
  { label: "Overall Quality",   dimension: "overall",       default: 70,  desc: "Alert when overall score drops below this" },
  { label: "Hallucination Rate", dimension: "hallucination", default: 5,   desc: "Alert when hallucination rate exceeds this %" },
  { label: "Escalation Rate",   dimension: "escalation",    default: 15,  desc: "Alert when escalation rate exceeds this %" },
];

// ─── Copied-to-clipboard mini hook ───────────────────────────────────────────
function useCopy() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return { copied, copy };
}

// ─── Platform card component ─────────────────────────────────────────────────
function PlatformCard({
  id, name, desc, icon: Icon, selected, onClick,
}: {
  id: string; name: string; desc: string; icon: React.ElementType;
  selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl text-left transition-all border ${
        selected
          ? "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.15)]"
          : "bg-[rgba(255,255,255,0.02)] border-transparent hover:bg-[rgba(255,255,255,0.04)]"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
        <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
      </div>
      <p className="text-xs text-[var(--text-muted)] leading-snug">{desc}</p>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const { error: showError, success: showSuccess } = useToast();

  // Wizard state
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: workspace name
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");

  // Step 2: connection
  const [platform, setPlatform] = useState<string | null>(null);
  const [customSubOption, setCustomSubOption] = useState<string | null>(null); // sdk | rest | webhook
  const [agentName, setAgentName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [connection, setConnection] = useState<{
    id: string; webhook_url: string; webhook_secret: string;
  } | null>(null);

  // Step 3: knowledge base files
  const [kbFiles, setKbFiles] = useState<File[]>([]);
  const kbInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Step 4: alert thresholds
  const [thresholds, setThresholds] = useState<Record<string, number>>(
    Object.fromEntries(ALERT_THRESHOLDS.map((t) => [t.dimension, t.default]))
  );
  const [notificationEmail, setNotificationEmail] = useState("");

  // Step 2: snippet fetching state
  const [snippet, setSnippet] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  // Auto-generate slug from workspace name
  useEffect(() => {
    setWorkspaceSlug(
      workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)
    );
  }, [workspaceName]);

  // Fetch SDK snippet when connection is created and sdk sub-option selected
  useEffect(() => {
    if (connection?.id && customSubOption === "sdk") {
      fetch(`/api/connections/${connection.id}/sdk-snippet`)
        .then((r) => r.json())
        .then((d) => setSnippet(d.snippet ?? null))
        .catch(() => {});
    }
  }, [connection?.id, customSubOption]);

  // ── Step handlers ──────────────────────────────────────────────────────────

  async function handleStep1() {
    if (!workspaceName.trim()) {
      setError("Please enter a workspace name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim(), slug: workspaceSlug }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save workspace name");
        return;
      }
      setStep(2);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep2() {
    if (!platform) {
      setError("Please select how your customers interact with your agent");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform === "upload" ? "csv" : platform,
          name: agentName || `${platform} Agent`,
          api_key: apiKey || undefined,
          config: platform === "zendesk" ? { subdomain } : platform === "freshdesk" ? { subdomain } : {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save connection");
        return;
      }
      setConnection(data.connection);
      setStep(3);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  function handleStep3Skip() {
    setStep(4);
  }

  async function handleStep3Continue() {
    // In a full implementation this would upload the files
    // For now, just advance
    setStep(4);
  }

  async function handleStep4() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thresholds: ALERT_THRESHOLDS.map((t) => ({
            dimension: t.dimension,
            threshold: thresholds[t.dimension] ?? t.default,
            enabled: true,
          })),
          notification_email: notificationEmail || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save alert thresholds");
        return;
      }
      setStep(5);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://agentgrade.com";

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Step progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = step > s.id;
          const isActive = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-[#10B981] text-white"
                      : isActive
                      ? "bg-[rgba(255,255,255,0.1)] text-[var(--text-primary)] border border-[rgba(255,255,255,0.15)]"
                      : "bg-[rgba(255,255,255,0.03)] text-[var(--text-muted)]"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-[10px] font-medium hidden sm:block ${
                    isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-10 h-px mb-4 ${
                    step > s.id ? "bg-[#10B981]" : "bg-[rgba(255,255,255,0.08)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-[rgba(239,68,68,0.1)] text-[#EF4444] text-sm border border-[rgba(239,68,68,0.15)]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Step 1: Workspace name ─────────────────────────────── */}
      {step === 1 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
            Name your workspace
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Your workspace is where all your agent quality data lives.
          </p>

          <div className="space-y-4 mb-8">
            <GlassInput
              label="Workspace name"
              placeholder="Acme Support"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStep1()}
            />
            {workspaceSlug && (
              <p className="text-xs text-[var(--text-muted)]">
                Slug: <span className="font-mono text-[var(--text-secondary)]">{workspaceSlug}</span>
              </p>
            )}
          </div>

          <GlassButton
            variant="primary"
            onClick={handleStep1}
            disabled={!workspaceName.trim() || saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Saving..." : "Continue"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}

      {/* ─── Step 2: Integration ───────────────────────────────── */}
      {step === 2 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
            How do your customers interact with your AI agent?
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Choose your platform so we can pull conversations automatically.
          </p>

          {/* Platform selection grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <PlatformCard id="intercom"  name="Intercom"           desc="Connect via API key — auto-import conversations" icon={MessageSquare} selected={platform === "intercom"}  onClick={() => setPlatform("intercom")} />
            <PlatformCard id="zendesk"   name="Zendesk"            desc="Connect via API token — pull from your inbox"    icon={MessageSquare} selected={platform === "zendesk"}   onClick={() => setPlatform("zendesk")} />
            <PlatformCard id="freshdesk" name="Freshdesk"          desc="Connect via API key — sync conversations"        icon={MessageSquare} selected={platform === "freshdesk"} onClick={() => setPlatform("freshdesk")} />
            <PlatformCard id="custom"    name="We built our own"   desc="SDK, REST API, or webhook URL"                   icon={Code2}         selected={platform === "custom"}    onClick={() => { setPlatform("custom"); setCustomSubOption(null); }} />
            <PlatformCard id="upload"    name="Upload manually"    desc="CSV or JSON file — instant audit"                icon={Upload}        selected={platform === "upload"}    onClick={() => setPlatform("upload")} />
          </div>

          {/* Conditional fields per platform */}
          {(platform === "intercom" || platform === "freshdesk") && (
            <div className="space-y-3 mb-6">
              <GlassInput label="Agent name" placeholder="My Support Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <GlassInput label={`${platform === "intercom" ? "Intercom" : "Freshdesk"} API key`} placeholder="Enter your API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p className="text-xs text-[var(--text-muted)]">
                {platform === "intercom"
                  ? "Find this in Intercom → Settings → Integrations → Developer Hub"
                  : "Find this in Freshdesk → Admin → API → Your API Key"}
              </p>
            </div>
          )}

          {platform === "zendesk" && (
            <div className="space-y-3 mb-6">
              <GlassInput label="Agent name" placeholder="My Support Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <GlassInput label="Zendesk subdomain" placeholder="yourcompany (from yourcompany.zendesk.com)" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
              <GlassInput label="API token" placeholder="Enter your Zendesk API token" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          )}

          {platform === "custom" && (
            <div className="mb-6">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">Choose how to send conversations:</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { id: "sdk",     label: "JavaScript SDK", icon: Code2,    desc: "Copy-paste snippet" },
                  { id: "rest",    label: "REST API",        icon: Globe,    desc: "Direct API calls" },
                  { id: "webhook", label: "Webhook URL",     icon: Webhook,  desc: "POST to our endpoint" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setCustomSubOption(opt.id)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      customSubOption === opt.id
                        ? "bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.15)]"
                        : "bg-[rgba(255,255,255,0.02)] border-transparent hover:bg-[rgba(255,255,255,0.04)]"
                    }`}
                  >
                    <opt.icon className="w-4 h-4 text-[var(--text-secondary)] mb-1.5" />
                    <p className="text-xs font-medium text-[var(--text-primary)]">{opt.label}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Show snippet/info after connection is created */}
              {connection && customSubOption === "sdk" && (
                <div className="space-y-2">
                  {snippet ? (
                    <div className="relative">
                      <pre className="p-3 rounded-xl bg-[rgba(0,0,0,0.3)] text-xs font-mono text-[var(--text-secondary)] overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                        {snippet}
                      </pre>
                      <button
                        onClick={() => copy(snippet)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 score-good" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Loading snippet...</p>
                  )}
                </div>
              )}

              {connection && customSubOption === "rest" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.2)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Endpoint</p>
                    <code className="text-xs font-mono text-[var(--text-secondary)]">POST {appUrl}/api/webhooks/ingest</code>
                  </div>
                  <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.2)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Authorization header</p>
                    <code className="text-xs font-mono text-[var(--text-secondary)]">Bearer {connection.webhook_secret}</code>
                  </div>
                  <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.2)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1.5">Example curl</p>
                    <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap">{`curl -X POST ${appUrl}/api/webhooks/ingest \\
  -H "Authorization: Bearer ${connection.webhook_secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "customer", "content": "..."}, {"role": "agent", "content": "..."}]}'`}</pre>
                  </div>
                </div>
              )}

              {connection && customSubOption === "webhook" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.2)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Paste this URL into your platform:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-[var(--text-secondary)] flex-1 truncate">{appUrl}/api/webhooks/ingest</code>
                      <button onClick={() => copy(`${appUrl}/api/webhooks/ingest`)} className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.08)] transition-colors">
                        {copied ? <Check className="w-3.5 h-3.5 score-good" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.2)]">
                    <p className="text-xs text-[var(--text-muted)] mb-1">Authorization secret:</p>
                    <code className="text-xs font-mono text-[var(--text-secondary)]">{connection.webhook_secret}</code>
                  </div>
                </div>
              )}

              {/* Show name field before connection is created */}
              {!connection && (
                <GlassInput label="Agent name" placeholder="My Custom Bot" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              )}
            </div>
          )}

          {platform === "upload" && (
            <div className="mb-6">
              <input ref={csvInputRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => { /* handle file */ }} />
              <div
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-[rgba(255,255,255,0.08)] rounded-xl p-8 text-center hover:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer"
              >
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Drop CSV or JSON file here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Each row: role, content, timestamp | customer_id
                </p>
                <button className="mt-3 text-xs text-[var(--text-secondary)] underline">
                  Download template
                </button>
              </div>
            </div>
          )}

          <GlassButton
            variant="primary"
            onClick={handleStep2}
            disabled={!platform || saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Connecting..." : "Continue"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}

      {/* ─── Step 3: Knowledge base ────────────────────────────── */}
      {step === 3 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
            Upload your knowledge base
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-2">
            We use this to verify your agent&apos;s accuracy and detect hallucinations.
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-8">
            Optional but recommended. You can always add this later in Settings.
          </p>

          {/* Platform-specific options */}
          {(platform === "intercom" || platform === "zendesk") && (
            <button className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.05)] transition-colors mb-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    Sync from {platform === "intercom" ? "Intercom Articles" : "Zendesk Help Center"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Automatically imports your help articles</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </button>
          )}

          {/* File upload */}
          <input ref={kbInputRef} type="file" accept=".pdf,.docx,.txt" multiple className="hidden"
            onChange={(e) => {
              if (e.target.files) setKbFiles(Array.from(e.target.files));
            }}
          />
          <div
            onClick={() => kbInputRef.current?.click()}
            className="border-2 border-dashed border-[rgba(255,255,255,0.08)] rounded-xl p-8 text-center hover:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer mb-4"
          >
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Help articles, FAQs, policy docs, product documentation
            </p>
          </div>

          {kbFiles.length > 0 && (
            <div className="space-y-1 mb-4">
              {kbFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">{f.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{(f.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <GlassButton
              variant="primary"
              onClick={handleStep3Continue}
              className="flex-1 flex items-center justify-center gap-2 !py-3"
            >
              {kbFiles.length > 0 ? "Upload & continue" : "Continue"} <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton onClick={handleStep3Skip} className="!py-3">
              Skip for now
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* ─── Step 4: Alert thresholds ──────────────────────────── */}
      {step === 4 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
            Set your alert thresholds
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Get notified when your agent&apos;s quality drops below these levels.
          </p>

          <div className="space-y-6 mb-8">
            {ALERT_THRESHOLDS.map((t) => (
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
                      value={thresholds[t.dimension] ?? t.default}
                      onChange={(e) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [t.dimension]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="glass-input w-16 px-2 py-1.5 text-sm text-center font-mono"
                    />
                    <span className="text-xs text-[var(--text-muted)]">%</span>
                  </div>
                </div>
                {/* Visual slider */}
                <div className="relative h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] mt-2">
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-[rgba(255,255,255,0.2)] transition-all"
                    style={{ width: `${thresholds[t.dimension] ?? t.default}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-8">
            <GlassInput
              label="Notification email (optional)"
              placeholder="alerts@yourcompany.com"
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              We&apos;ll email you when any threshold is breached.
            </p>
          </div>

          <GlassButton
            variant="primary"
            onClick={handleStep4}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Saving..." : "Save & continue"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}

      {/* ─── Step 5: All set! ──────────────────────────────────── */}
      {step === 5 && (
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(16,185,129,0.1)] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 score-good" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">You&apos;re all set!</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm mx-auto">
            AgentGrade is now connected to your agent. Your first quality report
            will be ready in approximately <strong>1 hour</strong> once conversations start flowing in.
          </p>

          {/* Connection status */}
          {connection && (
            <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] mb-6 text-left">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {platform === "intercom" ? "Intercom" : platform === "zendesk" ? "Zendesk" : platform === "freshdesk" ? "Freshdesk" : "Custom Agent"} connected
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1 ml-4">
                Conversations will be scored automatically as they come in.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <GlassButton
              variant="primary"
              onClick={() => router.push("/dashboard")}
              className="w-full flex items-center justify-center gap-2 !py-3"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton
              onClick={() => router.push("/settings")}
              className="w-full !py-2.5"
            >
              Manage settings
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
