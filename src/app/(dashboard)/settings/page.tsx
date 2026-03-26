"use client";
import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { Plug, Bell, Users, CreditCard, BookOpen, Trash2 } from "lucide-react";

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
                    ? "bg-white/[0.08] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-white/5"
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
          {activeTab === "connections" && (
            <div className="space-y-4">
              <GlassCard className="p-6">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Agent Connections</h2>

                {/* Existing connection */}
                <div className="p-4 rounded-xl bg-white/5 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Intercom — Support Bot</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Connected &middot; Last sync: 2 hours ago</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-score-good" />
                      <GlassButton size="sm">Sync now</GlassButton>
                    </div>
                  </div>
                </div>

                <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3 mt-6">Add new connection</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["Intercom", "Zendesk", "Custom Webhook"].map((platform) => (
                    <button
                      key={platform}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/[0.07] transition-colors text-center"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)]">{platform}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Connect</p>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Or upload conversations</h3>
                  <div className="border-2 border-dashed border-white/[0.12] rounded-xl p-8 text-center hover:border-white/20 transition-colors cursor-pointer">
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
                    value="https://agentgrade.com/api/webhooks/ingest/ws-demo"
                    className="glass-input flex-1 px-3 py-2 text-xs font-mono"
                  />
                  <GlassButton size="sm">Copy</GlassButton>
                </div>
              </GlassCard>
            </div>
          )}

          {activeTab === "alerts" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Alert Thresholds</h2>
              <p className="text-xs text-[var(--text-muted)] mb-6">Get notified when quality drops below these thresholds.</p>
              <div className="space-y-4">
                {[
                  { dim: "Overall Quality", value: 70 },
                  { dim: "Accuracy", value: 65 },
                  { dim: "Hallucination", value: 70 },
                  { dim: "Resolution", value: 60 },
                ].map((config) => (
                  <div key={config.dim} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">{config.dim}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">Alert below</span>
                      <input
                        type="number"
                        defaultValue={config.value}
                        className="glass-input w-16 px-2 py-1 text-sm text-center font-mono"
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <GlassButton className="mt-6">Save thresholds</GlassButton>
            </GlassCard>
          )}

          {activeTab === "team" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Team Members</h2>
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">You</p>
                    <p className="text-xs text-[var(--text-muted)]">Owner</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <GlassInput placeholder="Email address" className="flex-1" />
                <GlassButton>Invite</GlassButton>
              </div>
            </GlassCard>
          )}

          {activeTab === "knowledge" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Knowledge Base</h2>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                Upload your help docs, FAQs, and policies. Used to verify agent accuracy and detect hallucinations.
              </p>
              <div className="border-2 border-dashed border-white/[0.12] rounded-xl p-8 text-center hover:border-white/20 transition-colors cursor-pointer mb-4">
                <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Files are chunked and embedded for semantic search</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">refund-policy.pdf</p>
                    <p className="text-xs text-[var(--text-muted)]">12 chunks &middot; Uploaded Mar 20</p>
                  </div>
                  <button className="text-[var(--text-muted)] hover:text-score-critical transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">product-faq.txt</p>
                    <p className="text-xs text-[var(--text-muted)]">8 chunks &middot; Uploaded Mar 18</p>
                  </div>
                  <button className="text-[var(--text-muted)] hover:text-score-critical transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          {activeTab === "billing" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Billing</h2>
              <div className="p-4 rounded-xl bg-white/5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Starter Plan</p>
                    <p className="text-xs text-[var(--text-muted)]">&pound;199/month &middot; 5,000 conversations</p>
                  </div>
                  <GlassButton size="sm">Upgrade</GlassButton>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--text-secondary)]">Usage this month</span>
                    <span className="text-[var(--text-primary)] font-mono">127 / 5,000</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-white/20" style={{ width: "2.5%" }} />
                  </div>
                </div>
              </div>
              <GlassButton>Manage billing</GlassButton>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
