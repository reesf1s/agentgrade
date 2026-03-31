"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { UserButton } from "@clerk/nextjs";

const pathLabels: Record<string, string> = {
  "/dashboard":     "Overview",
  "/conversations": "Conversations",
  "/patterns":      "Issues",
  "/reports":       "Reports",
  "/benchmarks":    "Benchmarks",
  "/settings":      "Settings",
};

function getPageLabel(pathname: string | null): string {
  if (!pathname) return "";
  // Exact match first
  if (pathLabels[pathname]) return pathLabels[pathname];
  // Match by prefix (e.g. /conversations/[id])
  for (const [key, label] of Object.entries(pathLabels)) {
    if (pathname.startsWith(`${key}/`)) return label;
  }
  return "";
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageLabel = getPageLabel(pathname);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />

      <div className="flex min-h-screen flex-col pt-[52px] lg:pl-[220px] lg:pt-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-[#E9E9E7] bg-white px-5 lg:px-6">
          {/* Breadcrumb / page title */}
          <div className="flex items-center">
            {pageLabel && (
              <span className="text-[14px] font-medium text-[#37352F]">
                {pageLabel}
              </span>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                background: "rgba(15,123,61,0.08)",
                border: "1px solid rgba(15,123,61,0.15)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse-soft"
                style={{ background: "#0F7B3D" }}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: "#0F7B3D" }}
              >
                Live
              </span>
            </div>

            {/* User button */}
            <div
              className="rounded-md px-1.5 py-1 transition-colors"
              style={{
                background: "#F1F1EF",
                border: "1px solid #E9E9E7",
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
                    colorText: "#787774",
                  },
                }}
                showName
              />
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 lg:py-8">
          <div className="mx-auto w-full max-w-[1160px] animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayoutInner>{children}</DashboardLayoutInner>;
}
