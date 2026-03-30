import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getUserId } from "@/lib/auth/get-user";
import {
  Shield,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Check,
  Brain,
  FileText,
  Zap,
} from "lucide-react";

export default async function LandingPage() {
  const userId = await getUserId();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-base text-fg">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-edge bg-base/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-brand-muted flex items-center justify-center transition-shadow group-hover:shadow-glow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="currentColor" className="text-brand-light" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">AgentGrade</span>
          </Link>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link href="/reports" className="text-sm text-fg-secondary hover:text-fg transition-colors">
                  Dashboard
                </Link>
                <UserButton
                  appearance={{
                    elements: { userButtonAvatarBox: "w-9 h-9" },
                  }}
                />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-fg-secondary hover:text-fg transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white hover:bg-brand-light transition-all shadow-glow-sm hover:shadow-glow-brand"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-brand/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-[20%] w-[400px] h-[300px] rounded-full bg-brand/[0.02] blur-[80px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-fg-secondary border border-edge bg-surface mb-8 animate-fade-in">
            <div className="w-1.5 h-1.5 rounded-full bg-score-good animate-pulse-soft" />
            AI Agent Quality Management
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-[-0.03em] leading-[1.08] mb-6 animate-fade-in [animation-delay:100ms]">
            Know if your AI agents<br />
            <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">are actually good.</span>
          </h1>

          <p className="text-lg text-fg-secondary max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in [animation-delay:200ms]">
            Automatically evaluate every AI agent conversation across accuracy, hallucination,
            resolution, and tone. Get actionable prompt improvements, not just scores.
          </p>

          <div className="flex items-center justify-center gap-4 animate-fade-in [animation-delay:300ms]">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl bg-brand text-white hover:bg-brand-light transition-all shadow-glow-brand hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] active:scale-[0.98]"
            >
              Start free quality audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center px-8 py-3.5 text-base font-medium rounded-xl border border-edge text-fg-secondary hover:border-edge-strong hover:text-fg transition-all"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="pb-16 md:pb-28 px-6">
        <div className="max-w-5xl mx-auto animate-fade-in [animation-delay:400ms]">
          <div className="rounded-2xl border border-edge bg-surface/50 p-1 backdrop-blur-sm shadow-elevated">
            <div className="rounded-xl border border-edge bg-surface p-6 md:p-8 space-y-5">
              {/* Metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Overall Quality", value: "71%", color: "text-score-warning" },
                  { label: "Scored", value: "127", color: "text-fg" },
                  { label: "Hallucination Rate", value: "6.3%", color: "text-score-critical" },
                  { label: "Escalation Rate", value: "9.4%", color: "text-score-warning" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-edge bg-surface p-4 transition-all hover:border-edge-strong">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted mb-2">{stat.label}</p>
                    <p className={`text-2xl font-bold font-mono tabular-nums ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Prompt improvement */}
              <div className="rounded-xl border border-edge bg-surface p-4">
                <p className="text-sm font-semibold mb-3 text-fg">This week&apos;s top prompt improvement</p>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-muted border border-brand/20">
                  <Brain className="w-5 h-5 text-brand-light mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-fg-secondary leading-relaxed">
                      Your agent fabricated 3 integrations this week. Add an explicit integration list to the system prompt.
                    </p>
                    <p className="text-xs text-fg-muted mt-1.5">High priority &middot; Affects 3 conversations</p>
                  </div>
                </div>
              </div>

              {/* Flagged conversations */}
              <div className="rounded-xl border border-edge bg-surface p-4">
                <p className="text-sm font-semibold mb-3 text-fg">Recent flagged conversations</p>
                <div className="space-y-2">
                  {[
                    { customer: "anna@designco.com", score: 38, issue: "Fabricated Figma integration" },
                    { customer: "mike@startup.io", score: 45, issue: "Wrong refund amount" },
                  ].map((conv, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-base hover:bg-surface transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm text-fg-secondary truncate">{conv.customer}</span>
                        <span className="text-xs text-fg-muted hidden sm:block">{conv.issue}</span>
                      </div>
                      <span className="text-sm font-mono font-bold text-score-critical tabular-nums ml-3">
                        {conv.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">How it works</h2>
          <p className="text-center text-fg-secondary mb-16 max-w-xl mx-auto">
            Three ways to get your conversations in. One minute to first insights.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: MessageSquare, step: "01", title: "Connect your platform", desc: "Paste your Intercom or Zendesk API key. We pull conversations automatically via webhook." },
              { icon: FileText, step: "02", title: "Upload conversations", desc: "Drop a CSV or JSON file. Works with any AI agent — chatbots, copilots, internal tools." },
              { icon: Zap, step: "03", title: "Webhook any agent", desc: "Send conversations via our webhook URL. Works with any custom-built AI agent." },
            ].map((item, i) => (
              <div key={i} className="group rounded-2xl border border-edge bg-surface/50 p-6 transition-all hover:border-edge-strong hover:shadow-card-hover hover:-translate-y-0.5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center transition-shadow group-hover:shadow-glow-sm">
                    <item.icon className="w-5 h-5 text-brand-light" />
                  </div>
                  <span className="text-xs font-bold text-fg-faint font-mono">{item.step}</span>
                </div>
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-fg-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">Not just scores. Fixes.</h2>
          <p className="text-center text-fg-secondary mb-16 max-w-xl mx-auto">
            Every assessment comes with specific prompt improvements and knowledge base recommendations.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Shield, title: "Hallucination Detection", desc: "Cross-references every agent claim against your knowledge base. Catches fabricated features, wrong policies, invented procedures." },
              { icon: Brain, title: "Prompt Improvements", desc: "Specific, copy-paste-ready changes to your agent's system prompt. Not vague advice — exact text to add." },
              { icon: TrendingUp, title: "Quality Trending", desc: "Track accuracy, hallucination rate, and resolution quality over time. Spot regressions before customers do." },
              { icon: AlertTriangle, title: "Failure Patterns", desc: "Clusters low-scoring conversations by topic to find systemic issues. Surface recurring problems automatically." },
              { icon: BarChart3, title: "Benchmarks", desc: "See how your agent compares to similar companies after one month of data." },
              { icon: FileText, title: "Knowledge Gaps", desc: "Identifies topics your agent can't answer well and recommends exactly what to add to your knowledge base." },
            ].map((feature, i) => (
              <div key={i} className="group rounded-2xl border border-edge bg-surface/50 p-6 transition-all hover:border-edge-strong hover:shadow-card-hover hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center mb-4 transition-shadow group-hover:shadow-glow-sm">
                  <feature.icon className="w-5 h-5 text-brand-light" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-fg-secondary leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 tracking-tight">Simple pricing</h2>
          <p className="text-center text-fg-secondary mb-16">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                plan: "Starter", price: "£199", period: "/month",
                features: ["5,000 conversations/month", "1 agent integration", "Weekly quality reports", "Email alerts", "Prompt improvements"],
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
              <div
                key={tier.plan}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all hover:shadow-card-hover ${
                  tier.featured
                    ? "border-brand/30 bg-brand-muted/30 shadow-glow-sm"
                    : "border-edge bg-surface/50"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold mb-2">{tier.plan}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold font-mono tabular-nums">{tier.price}</span>
                  <span className="text-sm text-fg-muted">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-fg-secondary">
                      <Check className="w-4 h-4 mt-0.5 text-score-good flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`block text-center w-full rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    tier.featured
                      ? "bg-brand text-white hover:bg-brand-light shadow-glow-sm hover:shadow-glow-brand"
                      : "bg-surface border border-edge text-fg hover:bg-surface-hover hover:border-edge-strong"
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-28 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl border border-brand/20 bg-brand-muted/20 p-12 shadow-glow-sm">
            <h2 className="text-2xl font-bold mb-4">
              Get a free quality audit
            </h2>
            <p className="text-fg-secondary mb-8 leading-relaxed">
              Send us 100 conversations. We&apos;ll score them, find the patterns, and tell you
              exactly what to fix in your agent&apos;s prompts. Free, no commitment.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl bg-brand text-white hover:bg-brand-light transition-all shadow-glow-brand hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] active:scale-[0.98]"
            >
              Start your audit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-edge py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-brand-muted flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="currentColor" className="text-brand-light" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-fg-secondary">AgentGrade</span>
          </div>
          <p className="text-xs text-fg-muted">&copy; 2026 AgentGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
