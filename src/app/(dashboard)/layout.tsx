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
      <main className="relative min-h-screen px-4 pb-8 pt-20 lg:ml-[17rem] lg:px-6 lg:pt-5">
        <div className="mx-auto max-w-[104rem]">
          <div className="workspace-frame min-h-[calc(100vh-2.5rem)] px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
            <div className="workspace-toolbar mb-5 flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="page-eyebrow">AgentGrade</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Quality operations</span>
                  <span className="hidden text-[var(--text-muted)] sm:inline">·</span>
                  <span>Review real conversations, spot repeat issues, and keep the assistant improving.</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="operator-chip hidden sm:inline-flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Live workspace
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1.5">
                  <ThemeToggle />
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-2 py-1.5">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonBox: "flex items-center gap-3",
                        userButtonTrigger: "rounded-lg",
                        userButtonAvatarBox: "w-8 h-8",
                        userButtonOuterIdentifier: "text-sm font-medium text-[var(--text-primary)] hidden xl:block",
                      },
                    }}
                    showName
                  />
                </div>
              </div>
            </div>
            <div>{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
