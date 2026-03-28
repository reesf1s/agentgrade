import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative ml-[20rem] min-h-screen px-8 py-8">
        <div className="dashboard-shell mx-auto max-w-7xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
