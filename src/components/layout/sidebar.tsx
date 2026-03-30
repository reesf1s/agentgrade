"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  BarChart3,
  FileBarChart,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    title: "Operate",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/conversations", label: "Review queue", icon: MessageSquare },
      { href: "/reports", label: "Reports", icon: FileBarChart },
      { href: "/patterns", label: "Issues", icon: Sparkles },
      { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
    ],
  },
  {
    title: "Configure",
    items: [{ href: "/settings", label: "Setup", icon: Settings }],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all",
        isActive
          ? "bg-[var(--surface)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--panel-subtle)]",
          isActive && "border-[var(--border-strong)] bg-[var(--panel)]"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      {isActive ? <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    for (const section of navSections) {
      for (const item of section.items) {
        router.prefetch(item.href);
      }
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="fixed left-4 right-4 top-4 z-50 lg:hidden">
        <div className="workspace-toolbar flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" prefetch className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-primary)]">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="page-eyebrow">AgentGrade</p>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Review loop</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-2 text-[var(--text-primary)]"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-4 shadow-2xl transition-transform duration-200 lg:left-5 lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-[13.5rem] lg:rounded-[1.25rem] lg:border lg:shadow-none lg:glass-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-4 px-2">
          <Link href="/dashboard" prefetch className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-primary)]">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="page-eyebrow">AgentGrade</p>
              <p className="truncate text-[13px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Review loop
              </p>
            </div>
            <div className="operator-chip ml-auto shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-1 pr-1">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
