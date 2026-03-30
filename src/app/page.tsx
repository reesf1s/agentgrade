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
    <div className="min-h-screen bg-[#08080F] text-white">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#08080F]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">AgentGrade</span>
          </Link>
          <div className="flex items-center gap-6">
            {isSignedIn ? (
              <>
                <Link href="/reports" className="text-sm text-white/50 hover:text-white/90 transition-colors">
                  Dashboard
                </Link>
                <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-white/50 hover:text-white/90 transition-colors">
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-brand text-white hover:bg-brand-light transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-brand/[0.12] blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-white/50 mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0D9155] inline-block" />
            AI Agent Quality Management
          </div>

          <h1 className="text-[3.5rem] md:text-[5rem] font-bold tracking-[-0.045em] leading-[0.95] mb-7 text-white">
            Know if your AI<br />
            agents are actually<br />
            <span className="text-brand-light">good.</span>
          </h1>

          <p className="text-[1.05rem] text-white/45 max-w-xl mx-auto mb-12 leading-relaxed font-normal">
            Automatically evaluate every conversation across accuracy, hallucination,
            resolution, and tone. Get specific fixes, not just scores.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-[15px] font-semibold rounded-xl bg-brand text-white hover:bg-brand-light transition-colors"
            >
              Start free quality audit
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center px-7 py-3.5 text-[15px] font-medium rounded-xl border border-white/10 text-white/60 hover:text-white/90 hover:border-white/20 transition-all"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard mockup */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 overflow-hidden">
            <div className="rounded-xl border border-white/[0.06] bg-[#0C0C14] p-6 md:p-8 space-y-4">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 mb-5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="ml-3 text-[11px] text-white/20 font-mono">agentgrade.app/dashboard</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Overall Quality", value: "71%", color: "text-[#C98A00]" },
                  { label: "Scored", value: "127", color: "text-white" },
                  { label: "Hallucination Rate", value: "6.3%", color: "text-[#D03030]" },
                  { label: "Escalation Rate", value: "9.4%", color: "text-[#C98A00]" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30 mb-2">{stat.label}</p>
                    <p className={`text-2xl font-bold font-mono tabular-nums ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Prompt improvement */}
              <div className="rounded-xl border border-brand/[0.2] bg-brand/[0.06] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-light/70 mb-3">Top fix this week</p>
                <div className="flex items-start gap-3">
                  <Brain className="w-4 h-4 text-brand-light mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-white/70 leading-relaxed">
                      Your agent fabricated 3 integrations this week. Add an explicit integration list to the system prompt.
                    </p>
                    <p className="text-xs text-white/30 mt-1.5">High priority · 3 conversations affected</p>
                  </div>
                </div>
              </div>

              {/* Conversations */}
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
                {[
                  { customer: "anna@designco.com", score: 38, issue: "Fabricated Figma integration", color: "text-[#D03030]" },
                  { customer: "mike@startup.io", score: 45, issue: "Wrong refund amount", color: "text-[#D03030]" },
                  { customer: "sarah@agency.co", score: 78, issue: "Tone inconsistency", color: "text-[#C98A00]" },
                ].map((conv, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-sm text-white/60 truncate">{conv.customer}</span>
                      <span className="text-[11px] text-white/25 hidden sm:block">{conv.issue}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold tabular-nums ml-3 ${conv.color}`}>
                      {conv.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-light/60 mb-4">Setup</p>
            <h2 className="text-[2.2rem] font-bold tracking-[-0.03em] text-white mb-4">Get started in minutes</h2>
            <p className="text-white/40 max-w-lg mx-auto text-[15px]">
              Three ways in. One minute to your first quality score.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: MessageSquare, step: "01", title: "Connect your platform", desc: "Paste your Intercom or Zendesk API key. We pull conversations via webhook automatically." },
              { icon: FileText, step: "02", title: "Upload conversations", desc: "Drop a CSV or JSON file. Works with any AI agent — chatbots, copilots, internal tools." },
              { icon: Zap, step: "03", title: "Webhook any agent", desc: "Send conversations via our webhook URL. Works with any custom-built AI agent." },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 hover:border-white/[0.12] transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-brand/[0.12] flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-brand-light" />
                  </div>
                  <span className="text-[11px] font-bold text-white/20 font-mono tracking-[0.1em]">{item.step}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-light/60 mb-4">What you get</p>
            <h2 className="text-[2.2rem] font-bold tracking-[-0.03em] text-white mb-4">Not just scores. Fixes.</h2>
            <p className="text-white/40 max-w-lg mx-auto text-[15px]">
              Every assessment comes with specific prompt improvements and knowledge base recommendations.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Shield, title: "Hallucination Detection", desc: "Cross-references every agent claim against your knowledge base. Catches fabricated features, wrong policies, invented procedures." },
              { icon: Brain, title: "Prompt Improvements", desc: "Specific, copy-paste-ready changes to your agent's system prompt. Not vague advice — exact text to add." },
              { icon: TrendingUp, title: "Quality Trending", desc: "Track accuracy, hallucination rate, and resolution quality over time. Spot regressions before customers do." },
              { icon: AlertTriangle, title: "Failure Patterns", desc: "Clusters low-scoring conversations by topic. Surface recurring systemic issues automatically." },
              { icon: BarChart3, title: "Benchmarks", desc: "See how your agent compares to similar companies after one month of data." },
              { icon: FileText, title: "Knowledge Gaps", desc: "Identifies topics your agent can't answer well and recommends exactly what to add to your knowledge base." },
            ].map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-white/[0.12] transition-colors">
                <div className="w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center mb-4">
                  <feature.icon className="w-4 h-4 text-white/50" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-light/60 mb-4">Pricing</p>
            <h2 className="text-[2.2rem] font-bold tracking-[-0.03em] text-white mb-4">Simple pricing</h2>
            <p className="text-white/40 text-[15px]">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
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
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  tier.featured
                    ? "border-brand/40 bg-brand/[0.08]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-[11px] font-bold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-[15px] font-semibold text-white mb-2">{tier.plan}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold font-mono tabular-nums text-white">{tier.price}</span>
                  <span className="text-sm text-white/30">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/50">
                      <Check className="w-4 h-4 mt-0.5 text-[#0D9155] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`block text-center w-full rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    tier.featured
                      ? "bg-brand text-white hover:bg-brand-light"
                      : "border border-white/10 text-white/60 hover:text-white hover:border-white/20"
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
      <section className="py-24 px-6 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-[2.2rem] font-bold tracking-[-0.03em] text-white mb-4">
            Get a free quality audit
          </h2>
          <p className="text-white/40 mb-10 text-[15px] leading-relaxed max-w-lg mx-auto">
            Send us 100 conversations. We&apos;ll score them, find the patterns, and tell you
            exactly what to fix in your agent&apos;s prompts. Free, no commitment.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-[15px] font-semibold rounded-xl bg-brand text-white hover:bg-brand-light transition-colors"
          >
            Start your audit
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="#818CF8" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white/30">AgentGrade</span>
          </div>
          <p className="text-[12px] text-white/20">&copy; 2026 AgentGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
