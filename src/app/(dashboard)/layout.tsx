import { Sidebar } from "@/components/layout/sidebar";
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "#161618" }}>
      <Sidebar />

      <div className="flex min-h-screen flex-col lg:pl-56">
        <header
          className="dashboard-topbar sticky top-0 z-30 flex h-[46px] items-center justify-between gap-4 px-5 pt-14 lg:px-6 lg:pt-0"
        >
          <div className="hidden items-center gap-2 lg:flex">
            <span
              className="text-[11px] font-medium tracking-[0.06em] uppercase"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              Quality Ops
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-md px-2 py-1"
              style={{
                background: "rgba(78,167,107,0.08)",
                border: "1px solid rgba(78,167,107,0.15)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-soft"
                style={{ background: "#4EA76B" }}
              />
              <span className="text-[11px] font-medium" style={{ color: "#4EA76B" }}>
                Live
              </span>
            </div>
            <div
              className="rounded-md px-1.5 py-1 transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <UserButton
                appearance={{
                  elements: {
                    userButtonBox:             "flex items-center gap-2",
                    userButtonTrigger:         "rounded-md",
                    userButtonAvatarBox:       "w-5 h-5",
                    userButtonOuterIdentifier: "text-[12px] font-medium hidden xl:block",
                  },
                  variables: {
                    colorText: "rgba(255,255,255,0.6)",
                  },
                }}
                showName
              />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-[1160px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
