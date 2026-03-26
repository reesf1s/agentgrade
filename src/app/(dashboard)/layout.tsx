import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="gradient-bg min-h-screen">
      <Sidebar />
      <main className="ml-64 p-8">{children}</main>
    </div>
  );
}
