import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative ml-[18.5rem] min-h-screen px-6 py-6 lg:px-8">
        <div className="mx-auto mb-4 flex max-w-7xl items-center justify-between px-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">
              AgentGrade
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Quality operations for AI agents
            </p>
          </div>
          <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
            Trust-first scoring
          </div>
        </div>
        <div className="dashboard-shell mx-auto max-w-7xl p-5 md:p-7">{children}</div>
      </main>
    </div>
  );
}
