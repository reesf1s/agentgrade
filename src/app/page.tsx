import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  Zap,
  Shield,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Check,
  Brain,
  FileText,
} from "lucide-react";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-static p-6 ${className}`}>{children}</div>;
}

export default async function LandingPage() {
  const { userId } = await auth();
  return (
    <div className="min-h-screen bg-[var(--background)] light-page">
      {/* Nav */}
      <nav className="glass-sidebar fixed top-0 left-0 right-0 z-50 border-b border-[var(--glass-border)] !border-r-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AgentGrade</span>
          </Link>
          <div className="flex items-center gap-4">
            {userId ? (
              <Link href="/dashboard" className="glass-button glass-button-primary text-sm !py-2 !px-4">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Sign in
                </Link>
                <Link href="/sign-up" className="glass-button glass-button-primary text-sm !py-2 !px-4">
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass-static !rounded-full px-4 py-1.5 text-sm text-[var(--text-secondary)] mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI Agent Quality Management
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-[var(--text-primary)] leading-[1.1] mb-6">
            Know if your AI agents<br />are actually good.
          </h1>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatically evaluate every AI agent conversation across accuracy, hallucination,
            resolution, and tone. Get actionable prompt improvements, not just scores.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up" className="glass-button glass-button-primary !text-base !py-3 !px-8 inline-flex items-center gap-2">
              Start free quality audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#how-it-works" className="glass-button !text-base !py-3 !px-8">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Mock Dashboard Preview */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <GlassCard className="!p-8">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Overall Quality", value: "71%", color: "score-warning" },
                { label: "Conversations Scored", value: "127", color: "" },
                { label: "Hallucination Rate", value: "6.3%", color: "score-critical" },
                { label: "Escalation Rate", value: "9.4%", color: "score-warning" },
              ].map((stat) => (
                <div key={stat.label} className="glass-static !rounded-xl p-4">
                  <p className="text-xs text-[var(--text-muted)] mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="glass-static !rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-3">This week&apos;s top prompt improvement</p>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(0,0,0,0.02)]">
                <Brain className="w-5 h-5 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">
                    Your agent fabricated 3 integrations this week. Add an explicit integration list to the system prompt.
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">High priority &middot; Affects 3 conversations</p>
                </div>
              </div>
            </div>
            <div className="glass-static !rounded-xl p-4">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-3">Recent flagged conversations</p>
              <div className="space-y-2">
                {[
                  { customer: "anna@designco.com", score: 38, issue: "Fabricated Figma integration" },
                  { customer: "mike@startup.io", score: 45, issue: "Wrong refund amount" },
                ].map((conv, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-secondary)]">{conv.customer}</span>
                      <span className="text-xs text-[var(--text-muted)]">{conv.issue}</span>
                    </div>
                    <span className={`text-sm font-mono font-semibold ${conv.score < 50 ? "score-critical" : "score-warning"}`}>
                      {conv.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">How it works</h2>
          <p className="text-center text-[var(--text-secondary)] mb-16 max-w-xl mx-auto">
            Three ways to get your conversations in. One minute to first insights.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "Connect your platform", desc: "Paste your Intercom or Zendesk API key. We pull conversations automatically via webhook." },
              { icon: FileText, title: "Upload conversations", desc: "Drop a CSV or JSON file. Works with any AI agent — chatbots, copilots, internal tools." },
              { icon: Zap, title: "Webhook any agent", desc: "Send conversations via our webhook URL. Works with any custom-built AI agent." },
            ].map((step, i) => (
              <GlassCard key={i}>
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,0,0,0.04)] flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">Not just scores. Fixes.</h2>
          <p className="text-center text-[var(--text-secondary)] mb-16 max-w-xl mx-auto">
            Every assessment comes with specific prompt improvements and knowledge base recommendations.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Hallucination Detection", desc: "Cross-references every agent claim against your knowledge base. Catches fabricated features, wrong policies, invented procedures." },
              { icon: Brain, title: "Prompt Improvements", desc: "Specific, copy-paste-ready changes to your agent's system prompt. Not vague advice — exact text to add." },
              { icon: TrendingUp, title: "Quality Trending", desc: "Track accuracy, hallucination rate, and resolution quality over time. Spot regressions before customers do." },
              { icon: AlertTriangle, title: "Failure Patterns", desc: "Clusters low-scoring conversations by topic to find systemic issues. \"23 refund conversations failed this week.\"" },
              { icon: BarChart3, title: "Benchmarks", desc: "After 1 month: see how your agent compares to similar companies. 72nd percentile for accuracy." },
              { icon: FileText, title: "Knowledge Gap Detection", desc: "Identifies topics your agent can't answer well and recommends exactly what to add to your knowledge base." },
            ].map((feature, i) => (
              <GlassCard key={i}>
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,0,0,0.04)] flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-[var(--text-secondary)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">Simple pricing</h2>
          <p className="text-center text-[var(--text-secondary)] mb-16">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                plan: "Starter", price: "£199", period: "/month",
                features: ["5,000 conversations/month", "1 agent integration", "Weekly quality reports", "Email alerts", "Prompt improvement recommendations"],
              },
              {
                plan: "Growth", price: "£499", period: "/month", featured: true,
                features: ["25,000 conversations/month", "Unlimited integrations", "Benchmark dashboard", "Failure pattern detection", "Slack/Teams alerts", "Priority support"],
              },
              {
                plan: "Enterprise", price: "Custom", period: "",
                features: ["Unlimited conversations", "Custom scoring dimensions", "API access", "Dedicated onboarding", "SLA", "SSO"],
              },
            ].map((tier) => (
              <GlassCard key={tier.plan} className={tier.featured ? "!border-[rgba(0,0,0,0.12)] ring-1 ring-[rgba(0,0,0,0.04)]" : ""}>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{tier.plan}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold font-mono text-[var(--text-primary)]">{tier.price}</span>
                  <span className="text-sm text-[var(--text-muted)]">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <Check className="w-4 h-4 mt-0.5 text-[var(--text-muted)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`block text-center w-full ${tier.featured ? "glass-button glass-button-primary" : "glass-button"} !py-2.5`}
                >
                  Get started
                </Link>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <GlassCard className="!p-12">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-4">
              Get a free quality audit
            </h2>
            <p className="text-[var(--text-secondary)] mb-8">
              Send us 100 conversations. We&apos;ll score them, find the patterns, and tell you
              exactly what to fix in your agent&apos;s prompts. Free, no commitment.
            </p>
            <Link href="/sign-up" className="glass-button glass-button-primary !text-base !py-3 !px-8 inline-flex items-center gap-2">
              Start your audit <ArrowRight className="w-4 h-4" />
            </Link>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--glass-border)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--text-primary)] flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-[var(--text-secondary)]">AgentGrade</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 AgentGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
