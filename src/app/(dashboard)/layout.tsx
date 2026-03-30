import { Sidebar } from "@/components/layout/sidebar";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />

      {/* Main content — offset by sidebar width on lg */}
      <div className="flex flex-1 flex-col lg:pl-[14rem]">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-edge bg-base-white/90 backdrop-blur-xl px-5 pt-14 lg:pt-0">
          {/* Left — breadcrumb area */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-fg-muted">
            {/* Placeholder for future breadcrumbs / cmd-k */}
          </div>

          {/* Right — user */}
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-lg border border-edge bg-surface px-2.5 py-1.5 transition-colors hover:border-edge-strong">
              <UserButton
                appearance={{
                  elements: {
                    userButtonBox: "flex items-center gap-2",
                    userButtonTrigger: "rounded-md focus-visible:ring-2 focus-visible:ring-brand/50",
                    userButtonAvatarBox: "w-6 h-6",
                    userButtonOuterIdentifier: "text-xs font-medium text-fg-secondary hidden xl:block",
                  },
                }}
                showName
              />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-5 py-6 lg:px-8">
          <div className="mx-auto max-w-5xl animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
