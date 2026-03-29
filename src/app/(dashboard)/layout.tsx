import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative min-h-screen px-4 pb-6 pt-20 lg:ml-[17.5rem] lg:px-6 lg:pb-8 lg:pt-5">
        <div className="dashboard-topbar sticky top-4 z-30 mx-auto mb-4 hidden max-w-[88rem] items-center justify-between rounded-[1rem] px-5 py-3 lg:flex">
          <div className="flex items-center gap-4">
            <div>
              <p className="enterprise-kicker">AgentGrade</p>
              <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                Enterprise AI quality operations
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live workspace
          </div>
        </div>
        <div className="dashboard-shell mx-auto max-w-[88rem] p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
