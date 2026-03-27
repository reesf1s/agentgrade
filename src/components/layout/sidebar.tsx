"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserButton } from "@clerk/nextjs";
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

  return (
    <aside className="fixed left-6 top-6 z-40 flex h-[calc(100vh-3rem)] w-[17rem] flex-col rounded-[2rem] glass-sidebar px-4 py-5">
      <div className="mb-6 flex items-center justify-between px-2">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_16px_30px_rgba(148,163,184,0.2)]">
            <Zap className="h-4 w-4 text-slate-900" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Vision Control
            </p>
            <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              AgentGrade
            </span>
          </div>
        </Link>
        <div className="rounded-full border border-white/50 bg-white/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <ThemeToggle />
        </div>
      </div>

      <div className="glass-static mb-5 rounded-[1.75rem] p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Active cockpit
        </p>
        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
          Live monitoring for your AI estate
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Track quality drift, escalations, and hallucinations in one glass workspace.
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
              className={cn(
                "group flex items-center gap-3 rounded-[1.25rem] px-3.5 py-3 text-sm font-medium transition-all duration-300",
                isActive
                  ? "bg-white/55 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_30px_rgba(148,163,184,0.18)]"
                  : "bg-white/15 text-[var(--text-secondary)] hover:bg-white/35 hover:text-[var(--text-primary)]"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl border border-white/40 bg-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-300",
                  isActive && "bg-white/70"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1">{item.label}</span>
              {isActive ? (
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.5)]" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 border-t border-white/35 pt-4">
        <div className="glass-static rounded-[1.5rem] p-3">
          <UserButton
            appearance={{
              elements: {
                userButtonBox: "flex items-center gap-3 w-full",
                userButtonTrigger:
                  "flex items-center gap-3 w-full rounded-2xl p-1.5 transition-all hover:bg-white/35",
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
