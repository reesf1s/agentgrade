import { Sidebar } from "@/components/layout/sidebar";
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

        {/* Top bar — minimal */}
        <header className="sticky top-0 z-30 flex h-12 items-center justify-end gap-2 border-b border-[rgba(255,255,255,0.04)] bg-[rgba(10,10,15,0.80)] backdrop-blur-xl px-4 pt-14 pb-2 lg:pt-0">
          <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] px-2 py-1.5">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "flex items-center gap-2",
                  userButtonTrigger: "rounded-md",
                  userButtonAvatarBox: "w-6 h-6",
                  userButtonOuterIdentifier: "text-xs font-medium text-[rgba(255,255,255,0.70)] hidden xl:block",
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
