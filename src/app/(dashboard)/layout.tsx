import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative min-h-screen px-4 pb-8 pt-20 lg:ml-[17.5rem] lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-[96rem]">{children}</div>
      </main>
    </div>
  );
}
