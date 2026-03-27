"use client";
import { useState, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassInput } from "@/components/ui/glass-input";
import { Plug, Bell, Users, CreditCard, BookOpen, Trash2, Plus } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("connections");
  const [connections, setConnections] = useState<Array<{ id: string; name: string; platform: string; last_synced_at: string | null }>>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; title: string; chunk_count: number; created_at: string }>>([]);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhooks/ingest`);
    fetch("/api/connections").then(r => r.json()).then(d => setConnections(d.connections ?? [])).catch(() => {});
    fetch("/api/knowledge-base").then(r => r.json()).then(d => setKnowledgeItems(d.sources ?? [])).catch(() => {});
  }, []);

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
                    ? "bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface)]"
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

                {connections.length > 0 ? (
                  <div className="space-y-2 mb-6">
                    {connections.map((conn) => (
                      <div key={conn.id} className="p-4 rounded-xl bg-[var(--surface)] mb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{conn.name}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">
                              {conn.platform} &middot; {conn.last_synced_at ? `Last sync: ${new Date(conn.last_synced_at).toLocaleString()}` : "Never synced"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-score-good" />
                            <GlassButton size="sm">Sync now</GlassButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[var(--surface)] text-center mb-6">
                    <Plug className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--text-secondary)]">No connections yet</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Connect your agent below to get started</p>
                  </div>
                )}

                <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Add new connection</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["Intercom", "Zendesk", "Custom Webhook"].map((platform) => (
                    <button
                      key={platform}
                      className="p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors text-center"
                    >
                      <p className="text-sm font-medium text-[var(--text-primary)]">{platform}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">Connect</p>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Or upload conversations</h3>
                  <div className="border-2 border-dashed border-[var(--glass-border)] rounded-xl p-8 text-center hover:border-[var(--text-muted)] transition-colors cursor-pointer">
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
                  <GlassButton size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>Copy</GlassButton>
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
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">You</p>
                    <p className="text-xs text-[var(--text-muted)]">Owner</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <GlassInput placeholder="Email address" className="flex-1" />
                <GlassButton>
                  <Plus className="w-4 h-4 mr-1" />
                  Invite
                </GlassButton>
              </div>
            </GlassCard>
          )}

          {activeTab === "knowledge" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Knowledge Base</h2>
              <p className="text-xs text-[var(--text-muted)] mb-6">
                Upload your help docs, FAQs, and policies. Used to verify agent accuracy and detect hallucinations.
              </p>
              <div className="border-2 border-dashed border-[var(--glass-border)] rounded-xl p-8 text-center hover:border-[var(--text-muted)] transition-colors cursor-pointer mb-4">
                <BookOpen className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Drop PDF, DOCX, or TXT files here</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Files are chunked and embedded for semantic search</p>
              </div>
              {knowledgeItems.length > 0 ? (
                <div className="space-y-2">
                  {knowledgeItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)]">
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.chunk_count} chunks &middot; {new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      <button className="text-[var(--text-muted)] hover:text-score-critical transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No documents uploaded yet</p>
              )}
            </GlassCard>
          )}

          {activeTab === "billing" && (
            <GlassCard className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Billing</h2>
              <div className="p-6 rounded-xl bg-[var(--surface)] mb-6 text-center">
                <p className="text-sm text-[var(--text-secondary)]">Loading billing information&hellip;</p>
              </div>
              <GlassButton onClick={() => fetch("/api/billing/portal", { method: "POST" }).then(r => r.json()).then(d => { if (d.url) window.open(d.url, "_blank"); })}>
                Manage billing
              </GlassButton>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
