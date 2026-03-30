import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Sidebar />
      <main className="relative min-h-screen px-4 pb-6 pt-20 lg:ml-[16rem] lg:px-5 lg:pt-5">
        <div className="mx-auto max-w-[68.75rem]">
          <div className="workspace-frame min-h-[calc(100vh-2rem)] px-4 py-4 sm:px-5 lg:px-5 lg:py-5">
            <div className="workspace-toolbar mb-4 flex items-center justify-end gap-2 px-3 py-2">
              <div className="operator-chip hidden sm:inline-flex">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Live
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1.5">
                <ThemeToggle />
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2 py-1.5">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonBox: "flex items-center gap-2",
                      userButtonTrigger: "rounded-lg",
                      userButtonAvatarBox: "w-7 h-7",
                      userButtonOuterIdentifier: "text-sm font-medium text-[var(--text-primary)] hidden xl:block",
                    },
                  }}
                  showName
                />
              </div>
            </div>
            <div className="dense-grid">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
