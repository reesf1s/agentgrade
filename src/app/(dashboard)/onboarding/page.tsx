"use client";
import { useState, useRef } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { useRouter } from "next/navigation";
import { Plug, BookOpen, Bell, Check, ArrowRight, Upload, AlertCircle } from "lucide-react";

const steps = [
  { id: 1, title: "Connect your agent", icon: Plug },
  { id: 2, title: "Upload knowledge base", icon: BookOpen },
  { id: 3, title: "Set alert thresholds", icon: Bell },
];

const DEFAULT_THRESHOLDS = [
  { label: "Overall Quality", dimension: "overall", default: 70, desc: "Alert when overall score drops below" },
  { label: "Hallucination Score", dimension: "hallucination", default: 70, desc: "Alert when hallucinations exceed" },
  { label: "Escalation Rate", dimension: "resolution", default: 70, desc: "Alert when resolution score drops below" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [platform, setPlatform] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [thresholds, setThresholds] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_THRESHOLDS.map((t) => [t.dimension, t.default]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleStep1Continue() {
    if (!platform) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          name: agentName || `${platform} Connection`,
          api_key: apiKey || undefined,
          config: platform === "zendesk" ? { subdomain } : {},
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save connection");
        return;
      }

      if (data.connection?.webhook_secret) {
        setWebhookSecret(data.connection.webhook_secret);
      }

      setCurrentStep(2);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3Finish() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_thresholds: DEFAULT_THRESHOLDS.map((t) => ({
            dimension: t.dimension,
            value: thresholds[t.dimension] ?? t.default,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save thresholds");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-12">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                isDone ? "bg-[var(--text-primary)] text-white" : isActive ? "bg-[rgba(0,0,0,0.08)] text-[var(--text-primary)]" : "bg-[rgba(0,0,0,0.03)] text-[var(--text-muted)]"
              }`}>
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-sm ${isActive ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"}`}>
                {step.title}
              </span>
              {i < steps.length - 1 && <div className="w-12 h-px bg-[rgba(0,0,0,0.08)]" />}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-[rgba(239,68,68,0.08)] text-[#EF4444] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Connect */}
      {currentStep === 1 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Connect your AI agent</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Choose how to get your conversations into AgentGrade.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { id: "intercom", name: "Intercom", desc: "Connect via API key" },
              { id: "zendesk", name: "Zendesk", desc: "Connect via API key" },
              { id: "custom", name: "Custom Webhook", desc: "Send from any platform" },
              { id: "csv", name: "Upload CSV/JSON", desc: "Instant quality audit" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`p-4 rounded-xl text-left transition-all ${
                  platform === p.id
                    ? "bg-[rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.12)]"
                    : "bg-[rgba(0,0,0,0.02)] border border-transparent hover:bg-[rgba(0,0,0,0.04)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{p.desc}</p>
              </button>
            ))}
          </div>

          {platform && platform !== "csv" && (
            <div className="space-y-3 mb-6">
              <GlassInput
                label="Agent Name"
                placeholder="My Support Bot"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
            </div>
          )}

          {platform === "intercom" && (
            <div className="space-y-3 mb-6">
              <GlassInput
                label="Intercom API Key"
                placeholder="Enter your Intercom API key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                Find this in Intercom → Settings → Integrations → Developer Hub
              </p>
            </div>
          )}

          {platform === "zendesk" && (
            <div className="space-y-3 mb-6">
              <GlassInput
                label="Zendesk Subdomain"
                placeholder="yourcompany"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
              <GlassInput
                label="API Token"
                placeholder="Enter your Zendesk API token"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          {platform === "custom" && webhookSecret && (
            <div className="space-y-3 mb-6">
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Your webhook URL:</p>
                <code className="text-xs font-mono text-[var(--text-primary)]">
                  {process.env.NEXT_PUBLIC_APP_URL || "https://agentgrade.com"}/api/webhooks/ingest
                </code>
              </div>
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Authorization header:</p>
                <code className="text-xs font-mono text-[var(--text-primary)]">
                  Bearer {webhookSecret}
                </code>
              </div>
            </div>
          )}

          {platform === "csv" && (
            <div className="mb-6">
              <input ref={fileInputRef} type="file" accept=".csv,.json" className="hidden" />
              <div
                className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Drop your CSV or JSON file here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Expected format: each row is a message with role, content, timestamp
                </p>
              </div>
            </div>
          )}

          <GlassButton
            variant="primary"
            onClick={handleStep1Continue}
            disabled={!platform || saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Saving..." : "Continue"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}

      {/* Step 2: Knowledge Base */}
      {currentStep === 2 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Upload your knowledge base
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            We use this to verify your agent&apos;s accuracy and detect hallucinations. Optional but recommended.
          </p>

          <div className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer mb-6">
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Help articles, FAQs, policy docs, product documentation
            </p>
          </div>

          <div className="flex gap-3">
            <GlassButton
              variant="primary"
              onClick={() => setCurrentStep(3)}
              className="flex-1 flex items-center justify-center gap-2 !py-3"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton onClick={() => setCurrentStep(3)} className="!py-3">
              Skip for now
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Step 3: Alert Thresholds */}
      {currentStep === 3 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Set alert thresholds
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Get notified when your agent&apos;s quality drops below these levels.
          </p>

          <div className="space-y-5 mb-8">
            {DEFAULT_THRESHOLDS.map((threshold) => (
              <div key={threshold.dimension}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{threshold.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{threshold.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={thresholds[threshold.dimension] ?? threshold.default}
                      onChange={(e) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [threshold.dimension]: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="glass-input w-16 px-2 py-1.5 text-sm text-center font-mono"
                    />
                    <span className="text-xs text-[var(--text-muted)]">%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <GlassButton
            variant="primary"
            onClick={handleStep3Finish}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Saving..." : "Launch dashboard"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}
