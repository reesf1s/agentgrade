"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  FileText,
  Plug,
  Upload,
} from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";

const steps = [
  { id: 1, title: "Connect your agent", icon: Plug },
  { id: 2, title: "Upload knowledge base", icon: BookOpen },
  { id: 3, title: "Set alert thresholds", icon: Bell },
];

const DEFAULT_THRESHOLDS = [
  {
    label: "Overall Quality",
    dimension: "overall",
    default: 70,
    desc: "Alert when the weighted overall quality score drops below",
  },
  {
    label: "Hallucination Prevention",
    dimension: "hallucination",
    default: 75,
    desc: "Alert when grounding and factual reliability drop below",
  },
  {
    label: "Resolution Quality",
    dimension: "resolution",
    default: 70,
    desc: "Alert when the agent stops resolving issues effectively",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const conversationFileInputRef = useRef<HTMLInputElement>(null);
  const kbFileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [platform, setPlatform] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [thresholds, setThresholds] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_THRESHOLDS.map((threshold) => [threshold.dimension, threshold.default]))
  );
  const [saving, setSaving] = useState(false);
  const [uploadingKnowledgeBase, setUploadingKnowledgeBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [conversationUploadSummary, setConversationUploadSummary] = useState<string | null>(null);
  const [knowledgeBaseSummary, setKnowledgeBaseSummary] = useState<string | null>(null);
  const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";

  async function createConnection() {
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
      throw new Error(data.error || "Failed to save connection");
    }

    setWebhookSecret(data.connection?.webhook_secret || null);
    setWebhookUrl(data.connection?.webhook_url || null);

    return data.connection as {
      webhook_secret?: string;
      webhook_url?: string;
    };
  }

  async function handleStep1Continue() {
    if (!platform) return;

    if (platform === "intercom" && !apiKey.trim()) {
      setError("Enter your Intercom API key to continue.");
      return;
    }

    if (platform === "zendesk" && (!subdomain.trim() || !apiKey.trim())) {
      setError("Enter your Zendesk subdomain and API token to continue.");
      return;
    }

    if (platform === "csv" && !conversationFileInputRef.current?.files?.[0]) {
      setError("Choose a CSV or JSON export so we can run your first audit.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const connection = await createConnection();

      if (platform === "csv") {
        const file = conversationFileInputRef.current?.files?.[0];
        if (!file || !connection.webhook_secret) {
          throw new Error("Could not prepare the upload connection.");
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("platform", "csv");

        const res = await fetch("/api/ingest/csv", {
          method: "POST",
          headers: {
            "x-agentgrade-api-key": connection.webhook_secret,
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to upload conversation file");
        }

        setConversationUploadSummary(
          `${data.conversations_ingested ?? 0} conversations ingested and queued for scoring.`
        );
      }

      setCurrentStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleKnowledgeBaseContinue(skipUpload = false) {
    const file = kbFileInputRef.current?.files?.[0];

    if (skipUpload || !file) {
      setCurrentStep(3);
      return;
    }

    setUploadingKnowledgeBase(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload knowledge base");
      }

      setKnowledgeBaseSummary(
        `${data.chunks_created ?? 0} knowledge chunks indexed from ${data.source || file.name}.`
      );
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge base upload failed");
    } finally {
      setUploadingKnowledgeBase(false);
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
          alert_thresholds: DEFAULT_THRESHOLDS.map((threshold) => ({
            dimension: threshold.dimension,
            value: thresholds[threshold.dimension] ?? threshold.default,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save thresholds");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="flex items-center justify-center gap-3 mb-12">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isDone = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isDone
                    ? "bg-[var(--text-primary)] text-white"
                    : isActive
                      ? "bg-[rgba(0,0,0,0.08)] text-[var(--text-primary)]"
                      : "bg-[rgba(0,0,0,0.03)] text-[var(--text-muted)]"
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-sm ${
                  isActive ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                }`}
              >
                {step.title}
              </span>
              {index < steps.length - 1 && <div className="w-12 h-px bg-[rgba(0,0,0,0.08)]" />}
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

      {currentStep === 1 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Connect your AI agent</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Choose how conversations should flow into AgentGrade. We&apos;ll create the connection and give you the exact credentials you need.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { id: "intercom", name: "Intercom", desc: "API key + manual sync for support conversations" },
              { id: "zendesk", name: "Zendesk", desc: "API token connection for ticket conversations" },
              { id: "voiceflow", name: "Voiceflow", desc: "Send transcript turns from a custom action" },
              { id: "dealkit", name: "DealKit Ask AI", desc: "Push Ask AI transcripts with the secure webhook" },
              { id: "custom", name: "Custom Webhook", desc: "Any internal copilot, chatbot, or agent runtime" },
              { id: "csv", name: "Upload CSV/JSON", desc: "Run an instant historical audit" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setPlatform(option.id)}
                className={`p-4 rounded-xl text-left transition-all ${
                  platform === option.id
                    ? "bg-[rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.12)]"
                    : "bg-[rgba(0,0,0,0.02)] border border-transparent hover:bg-[rgba(0,0,0,0.04)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{option.name}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{option.desc}</p>
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
                Find this in Intercom → Settings → Integrations → Developer Hub.
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

          {(platform === "custom" || platform === "voiceflow" || platform === "dealkit") && (
            <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)] text-sm text-[var(--text-secondary)] mb-6">
              We&apos;ll generate a secure webhook URL and bearer secret on the next step. Recommended trigger:
              {platform === "voiceflow"
                ? " call AgentGrade from a Voiceflow custom action after each assistant turn or when the session closes."
                : platform === "dealkit"
                  ? " post the Ask AI transcript after each completed reply or when a deal conversation escalates."
                  : " send transcript updates after each agent reply or when the conversation closes."}
            </div>
          )}

          {platform === "csv" && (
            <div className="mb-6">
              <input
                ref={conversationFileInputRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={() => {
                  setConversationUploadSummary(null);
                  setError(null);
                }}
              />
              <div
                className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer"
                onClick={() => conversationFileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Choose your CSV or JSON export</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Expected format: each row is a message with `conversation_id`, `role`, `content`, and optional `timestamp`.
                </p>
                {conversationFileInputRef.current?.files?.[0] && (
                  <p className="text-xs text-[var(--text-primary)] mt-3">
                    Selected: {conversationFileInputRef.current.files[0].name}
                  </p>
                )}
              </div>
            </div>
          )}

          <GlassButton
            variant="primary"
            onClick={handleStep1Continue}
            disabled={!platform || saving}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            {saving ? "Setting up..." : "Continue"} <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}

      {currentStep === 2 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Upload your knowledge base
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            We use this content to verify factual claims, catch hallucinations, and improve how precisely your bot is assessed.
          </p>

          {(platform === "custom" || platform === "voiceflow" || platform === "dealkit") && webhookSecret && (
            <div className="space-y-3 mb-6">
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Your webhook URL</p>
                <code className="text-xs font-mono text-[var(--text-primary)] break-all">
                  {webhookUrl || `${browserOrigin}/api/webhooks/ingest`}
                </code>
              </div>
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Authorization header</p>
                <code className="text-xs font-mono text-[var(--text-primary)] break-all">
                  Bearer {webhookSecret}
                </code>
              </div>
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)] text-xs text-[var(--text-secondary)]">
                {platform === "voiceflow" && "Voiceflow recipe: add a custom action that POSTs the current session transcript and variables to AgentGrade after each assistant reply."}
                {platform === "dealkit" && "DealKit recipe: send DealKit Ask AI conversation turns, contact/deal identifiers, and any escalation metadata to AgentGrade using the secure webhook."}
                {platform === "custom" && "Custom recipe: send the conversation transcript from your runtime, server, or workflow tool using the secure webhook."}
              </div>
            </div>
          )}

          {conversationUploadSummary && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-[rgba(34,197,94,0.08)] text-[#15803D] text-sm">
              <FileText className="w-4 h-4 flex-shrink-0" />
              {conversationUploadSummary}
            </div>
          )}

          <input
            ref={kbFileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.json"
            className="hidden"
            onChange={() => {
              setKnowledgeBaseSummary(null);
              setError(null);
            }}
          />

          <div
            className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer mb-6"
            onClick={() => kbFileInputRef.current?.click()}
          >
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Choose PDF, DOCX, TXT, Markdown, or JSON files</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Help articles, FAQs, policy docs, product documentation, and support playbooks all improve scoring fidelity.
            </p>
            {kbFileInputRef.current?.files?.[0] && (
              <p className="text-xs text-[var(--text-primary)] mt-3">
                Selected: {kbFileInputRef.current.files[0].name}
              </p>
            )}
          </div>

          {knowledgeBaseSummary && (
            <div className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-[rgba(34,197,94,0.08)] text-[#15803D] text-sm">
              <Check className="w-4 h-4 flex-shrink-0" />
              {knowledgeBaseSummary}
            </div>
          )}

          <div className="flex gap-3">
            <GlassButton
              variant="primary"
              onClick={() => handleKnowledgeBaseContinue(false)}
              disabled={uploadingKnowledgeBase}
              className="flex-1 flex items-center justify-center gap-2 !py-3"
            >
              {uploadingKnowledgeBase ? "Uploading..." : "Continue"} <ArrowRight className="w-4 h-4" />
            </GlassButton>
            <GlassButton onClick={() => handleKnowledgeBaseContinue(true)} className="!py-3">
              Skip for now
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {currentStep === 3 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Set alert thresholds
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            These thresholds control when AgentGrade warns you that conversation quality is slipping.
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
                          [threshold.dimension]: parseInt(e.target.value, 10) || 0,
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
