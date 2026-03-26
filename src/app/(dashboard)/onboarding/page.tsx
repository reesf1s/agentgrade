"use client";
import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { Plug, BookOpen, Bell, Check, ArrowRight, Upload } from "lucide-react";

const steps = [
  { id: 1, title: "Connect your agent", icon: Plug },
  { id: 2, title: "Upload knowledge base", icon: BookOpen },
  { id: 3, title: "Set alert thresholds", icon: Bell },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [platform, setPlatform] = useState<string | null>(null);

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
              {i < steps.length - 1 && (
                <div className="w-12 h-px bg-[rgba(0,0,0,0.08)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Connect */}
      {currentStep === 1 && (
        <GlassCard className="p-8">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Connect your AI agent
          </h2>
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

          {platform === "intercom" && (
            <div className="space-y-3 mb-6">
              <GlassInput label="Intercom API Key" placeholder="Enter your Intercom API key" type="password" />
              <p className="text-xs text-[var(--text-muted)]">
                Find this in Intercom &rarr; Settings &rarr; Integrations &rarr; Developer Hub
              </p>
            </div>
          )}

          {platform === "zendesk" && (
            <div className="space-y-3 mb-6">
              <GlassInput label="Zendesk Subdomain" placeholder="yourcompany" />
              <GlassInput label="API Token" placeholder="Enter your Zendesk API token" type="password" />
            </div>
          )}

          {platform === "custom" && (
            <div className="space-y-3 mb-6">
              <GlassInput label="Agent Name" placeholder="My Support Bot" />
              <div className="p-3 rounded-xl bg-[rgba(0,0,0,0.02)]">
                <p className="text-xs text-[var(--text-secondary)] mb-1">Your webhook URL:</p>
                <code className="text-xs font-mono text-[var(--text-primary)]">
                  https://agentgrade.com/api/webhooks/ingest/your-id
                </code>
              </div>
            </div>
          )}

          {platform === "csv" && (
            <div className="mb-6">
              <div className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer">
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
            onClick={() => setCurrentStep(2)}
            disabled={!platform}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            Continue <ArrowRight className="w-4 h-4" />
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
            We use this to verify your agent&apos;s accuracy and detect hallucinations.
            Optional but recommended.
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
            <GlassButton
              onClick={() => setCurrentStep(3)}
              className="!py-3"
            >
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
            {[
              { label: "Overall Quality", default: 70, desc: "Alert when overall score drops below" },
              { label: "Hallucination Score", default: 70, desc: "Alert when hallucinations exceed" },
              { label: "Escalation Rate", default: 15, desc: "Alert when escalation rate exceeds" },
            ].map((threshold) => (
              <div key={threshold.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{threshold.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{threshold.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      defaultValue={threshold.default}
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
            onClick={() => window.location.href = "/dashboard"}
            className="w-full flex items-center justify-center gap-2 !py-3"
          >
            Launch dashboard <ArrowRight className="w-4 h-4" />
          </GlassButton>
        </GlassCard>
      )}
    </div>
  );
}
