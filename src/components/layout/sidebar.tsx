"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButton } from "@clerk/nextjs";
import { useEffect } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FileBarChart,
  AlertTriangle,
  BarChart3,
  Settings,
  Zap,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/patterns", label: "Patterns", icon: AlertTriangle },
  { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <aside className="fixed left-5 top-5 z-40 flex h-[calc(100vh-2.5rem)] w-[16rem] flex-col rounded-[1.6rem] glass-sidebar px-3 py-4">
      <div className="mb-5 flex items-center justify-between px-2">
        <Link href="/dashboard" prefetch className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] text-[var(--text-primary)]">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Quality Ops
            </p>
            <span className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
              AgentGrade
            </span>
          </div>
        </Link>
        <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--panel)] p-1.5">
          <ThemeToggle />
        </div>
      </div>

      <div className="glass-static mb-5 rounded-[1.1rem] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Workspace
          </p>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Live
          </span>
        </div>
        <p className="text-sm font-semibold leading-5 text-[var(--text-primary)]">
          Quality command center
        </p>
        <p className="mt-1.5 text-xs leading-5 text-[var(--text-secondary)]">
          Ingest conversations, audit AI quality, and ship fixes with an evidence trail.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Mode</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">Trust-first</p>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Scope</p>
            <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">Workspace</p>
          </div>
        </div>
      </div>

      <div className="mb-3 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--text-muted)]">
          Navigation
        </p>
      </div>

      <nav className="flex-1 space-y-2">
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
                "group flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--panel-subtle)] transition-all duration-200",
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
  );
}
