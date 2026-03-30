import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Main content — offset by sidebar width on lg */}
      <div className="flex flex-1 flex-col lg:pl-[13.5rem]">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-end gap-2 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl px-4 pt-14 pb-2 lg:pt-0">
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1.5">
            <ThemeToggle />
          </div>
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2 py-1.5">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "flex items-center gap-2",
                  userButtonTrigger: "rounded-md",
                  userButtonAvatarBox: "w-6 h-6",
                  userButtonOuterIdentifier: "text-xs font-medium text-[var(--text-primary)] hidden xl:block",
                },
              }}
              showName
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-[68.75rem]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
