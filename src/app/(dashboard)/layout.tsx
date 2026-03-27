import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] vision-shell">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="vision-orb vision-orb-left" />
        <div className="vision-orb vision-orb-right" />
        <div className="vision-grid" />
      </div>
      <Sidebar />
      <main className="relative ml-[20rem] min-h-screen px-8 py-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
