import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getUserId } from "@/lib/auth/get-user";
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

export default async function LandingPage() {
  const userId = await getUserId();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[rgba(255,255,255,0.90)]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(10,10,15,0.80)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[rgba(255,255,255,0.06)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[rgba(255,255,255,0.50)]" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AgentGrade</span>
          </Link>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <Link href="/reports" className="text-sm text-[rgba(255,255,255,0.50)] hover:text-[rgba(255,255,255,0.90)] transition-colors">
                  Dashboard
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-9 h-9",
                    },
                  }}
                />
              </>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-[rgba(255,255,255,0.50)] hover:text-[rgba(255,255,255,0.90)] transition-colors">
                  Sign in
                </Link>
                <Link href="/sign-up" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.10)] text-[rgba(255,255,255,0.90)] hover:bg-[rgba(255,255,255,0.12)] transition-all">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[rgba(255,255,255,0.02)] blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-[rgba(255,255,255,0.40)] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI Agent Quality Management
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-6">
            Know if your AI agents<br />are actually good.
          </h1>
          <p className="text-lg text-[rgba(255,255,255,0.45)] max-w-2xl mx-auto mb-10 leading-relaxed">
            Automatically evaluate every AI agent conversation across accuracy, hallucination,
            resolution, and tone. Get actionable prompt improvements, not just scores.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-8 py-3 text-base font-medium rounded-xl bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.12)] transition-all">
              Start free quality audit <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#how-it-works" className="inline-flex items-center px-8 py-3 text-base font-medium rounded-xl border border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.50)] hover:border-[rgba(255,255,255,0.10)] hover:text-[rgba(255,255,255,0.70)] transition-all">
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Mock Dashboard Preview */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-8 backdrop-blur-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Overall Quality", value: "71%", color: "#F59E0B" },
                { label: "Scored", value: "127", color: "rgba(255,255,255,0.90)" },
                { label: "Hallucination Rate", value: "6.3%", color: "#EF4444" },
                { label: "Escalation Rate", value: "9.4%", color: "#F59E0B" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.25)] mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4 mb-4">
              <p className="text-sm font-medium mb-3">This week&apos;s top prompt improvement</p>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
                <Brain className="w-5 h-5 text-[rgba(255,255,255,0.30)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-[rgba(255,255,255,0.70)]">
                    Your agent fabricated 3 integrations this week. Add an explicit integration list to the system prompt.
                  </p>
                  <p className="text-xs text-[rgba(255,255,255,0.25)] mt-1">High priority &middot; Affects 3 conversations</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4">
              <p className="text-sm font-medium mb-3">Recent flagged conversations</p>
              <div className="space-y-2">
                {[
                  { customer: "anna@designco.com", score: 38, issue: "Fabricated Figma integration" },
                  { customer: "mike@startup.io", score: 45, issue: "Wrong refund amount" },
                ].map((conv, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[rgba(255,255,255,0.03)]">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[rgba(255,255,255,0.60)]">{conv.customer}</span>
                      <span className="text-xs text-[rgba(255,255,255,0.30)]">{conv.issue}</span>
                    </div>
                    <span className="text-sm font-mono font-semibold text-[#EF4444]">
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
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">How it works</h2>
          <p className="text-center text-[rgba(255,255,255,0.45)] mb-16 max-w-xl mx-auto">
            Three ways to get your conversations in. One minute to first insights.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: MessageSquare, title: "Connect your platform", desc: "Paste your Intercom or Zendesk API key. We pull conversations automatically via webhook." },
              { icon: FileText, title: "Upload conversations", desc: "Drop a CSV or JSON file. Works with any AI agent — chatbots, copilots, internal tools." },
              { icon: Zap, title: "Webhook any agent", desc: "Send conversations via our webhook URL. Works with any custom-built AI agent." },
            ].map((step, i) => (
              <div key={i} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6">
                <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-[rgba(255,255,255,0.40)]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-[rgba(255,255,255,0.45)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">Not just scores. Fixes.</h2>
          <p className="text-center text-[rgba(255,255,255,0.45)] mb-16 max-w-xl mx-auto">
            Every assessment comes with specific prompt improvements and knowledge base recommendations.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "Hallucination Detection", desc: "Cross-references every agent claim against your knowledge base. Catches fabricated features, wrong policies, invented procedures." },
              { icon: Brain, title: "Prompt Improvements", desc: "Specific, copy-paste-ready changes to your agent's system prompt. Not vague advice — exact text to add." },
              { icon: TrendingUp, title: "Quality Trending", desc: "Track accuracy, hallucination rate, and resolution quality over time. Spot regressions before customers do." },
              { icon: AlertTriangle, title: "Failure Patterns", desc: "Clusters low-scoring conversations by topic to find systemic issues. Surface recurring problems automatically." },
              { icon: BarChart3, title: "Benchmarks", desc: "See how your agent compares to similar companies after one month of data." },
              { icon: FileText, title: "Knowledge Gaps", desc: "Identifies topics your agent can't answer well and recommends exactly what to add to your knowledge base." },
            ].map((feature, i) => (
              <div key={i} className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-6">
                <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-[rgba(255,255,255,0.40)]" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-[rgba(255,255,255,0.45)] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center mb-4 tracking-tight">Simple pricing</h2>
          <p className="text-center text-[rgba(255,255,255,0.45)] mb-16">Start free. Upgrade when you need more.</p>
          <div className="grid md:grid-cols-3 gap-6">
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
                className={`rounded-2xl border p-6 ${
                  tier.featured
                    ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <h3 className="text-lg font-semibold mb-2">{tier.plan}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold font-mono">{tier.price}</span>
                  <span className="text-sm text-[rgba(255,255,255,0.30)]">{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[rgba(255,255,255,0.50)]">
                      <Check className="w-4 h-4 mt-0.5 text-[#10B981]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`block text-center w-full rounded-lg py-2.5 text-sm font-medium border transition-all ${
                    tier.featured
                      ? "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.12)]"
                      : "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.06)]"
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
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-12">
            <h2 className="text-2xl font-semibold mb-4">
              Get a free quality audit
            </h2>
            <p className="text-[rgba(255,255,255,0.45)] mb-8">
              Send us 100 conversations. We&apos;ll score them, find the patterns, and tell you
              exactly what to fix in your agent&apos;s prompts. Free, no commitment.
            </p>
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-8 py-3 text-base font-medium rounded-xl bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.12)] transition-all">
              Start your audit <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.04)] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[rgba(255,255,255,0.06)] flex items-center justify-center">
              <Zap className="w-3 h-3 text-[rgba(255,255,255,0.50)]" />
            </div>
            <span className="text-sm font-medium text-[rgba(255,255,255,0.40)]">AgentGrade</span>
          </div>
          <p className="text-xs text-[rgba(255,255,255,0.20)]">&copy; 2026 AgentGrade. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
