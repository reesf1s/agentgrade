"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FileBarChart,
  AlertTriangle,
  BarChart3,
  Settings,
  Zap,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/patterns", label: "Insights", icon: AlertTriangle },
  { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/settings", label: "Setup", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="fixed left-4 right-4 top-4 z-50 lg:hidden">
        <div className="dashboard-topbar flex items-center justify-between rounded-[1.25rem] px-4 py-3">
          <Link href="/dashboard" prefetch className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--sidebar-accent)] text-[var(--text-primary)] shadow-sm">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                AgentGrade
              </p>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                AI quality control
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] p-1.5">
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] p-2 text-[var(--text-primary)]"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-[var(--border-subtle)] bg-[var(--panel)] px-4 py-4 shadow-2xl transition-transform duration-200 lg:left-5 lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[15.5rem] lg:rounded-[1.5rem] lg:border lg:shadow-none lg:glass-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-5 flex items-center justify-between px-2">
          <Link href="/dashboard" prefetch className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--sidebar-accent)] text-[var(--text-primary)]">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                AgentGrade
              </p>
              <span className="text-[15px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Quality ops
              </span>
            </div>
          </Link>
          <div className="hidden rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] p-1.5 lg:block">
            <ThemeToggle />
          </div>
        </div>

        <div className="mb-4 rounded-[1rem] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Workspace
            </p>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
              Live
            </span>
          </div>
          <p className="text-sm font-semibold leading-5 text-[var(--text-primary)]">
            Review quality, spot drift, and tighten your assistant.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Primary use</p>
              <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">Trust reviews</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Status</p>
              <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">Tracking live</p>
            </div>
          </div>
        </div>

        <div className="mb-3 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Navigation
          </p>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onMouseEnter={() => router.prefetch(item.href)}
                className={cn(
                  "group flex items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--panel-subtle)] transition-all duration-200",
                    isActive && "bg-[var(--panel)]"
                  )}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="flex-1">{item.label}</span>
                {isActive ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <div className="glass-static rounded-[1rem] p-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonBox: "flex items-center gap-3 w-full",
                  userButtonTrigger: "flex items-center gap-3 w-full rounded-xl p-1.5 transition-all hover:bg-[var(--surface)]",
                  userButtonAvatarBox: "w-10 h-10",
                  userButtonOuterIdentifier:
                    "text-sm font-medium text-[var(--text-primary)] truncate",
                },
              }}
              showName
            />
          </div>
        </div>
      </aside>
    </>
  );
}
