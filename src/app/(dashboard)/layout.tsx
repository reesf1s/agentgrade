import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative min-h-screen px-4 pb-6 pt-20 lg:ml-[18.75rem] lg:px-7 lg:pb-8 lg:pt-5">
        <div className="dashboard-topbar sticky top-4 z-30 mx-auto mb-5 hidden max-w-7xl items-center justify-between rounded-[1.4rem] px-5 py-3 lg:flex">
          <div>
            <p className="enterprise-kicker">
              AgentGrade
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              Quality operations for AI teams
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Clear scores, clear risk, clear next actions
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] shadow-sm md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live workspace view
          </div>
        </div>
        <div className="dashboard-shell mx-auto max-w-7xl p-5 md:p-7">{children}</div>
      </main>
    </div>
  );
}
