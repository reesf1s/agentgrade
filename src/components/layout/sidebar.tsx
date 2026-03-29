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
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
        isActive
          ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--panel-subtle)]",
          isActive && "border-[var(--border-strong)] bg-[var(--panel)]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <span
        className={cn(
          "h-2 w-2 rounded-full transition-all",
          isActive ? "bg-sky-500" : "bg-transparent"
        )}
      />
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
          <Link href="/dashboard" prefetch className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-primary)]">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="page-eyebrow">
                AgentGrade
              </p>
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
          "fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col border-r border-[var(--border-subtle)] bg-[var(--panel)] px-3 py-4 shadow-2xl transition-transform duration-200 lg:left-6 lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-[14rem] lg:rounded-[1.5rem] lg:border lg:shadow-none lg:glass-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-5 px-2">
          <Link href="/dashboard" prefetch className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--text-primary)]">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="page-eyebrow">
                AgentGrade
              </p>
              <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Ops console
              </p>
            </div>
          </Link>
        </div>

        <div className="mb-5 px-2">
          <div className="operator-chip">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live workspace
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-1 pr-1">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {section.title}
              </p>
              <div className="space-y-1">
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

        <div className="mt-5 border-t border-[var(--border-subtle)] px-2 pt-4">
          <p className="text-xs text-[var(--text-secondary)]">Review fast. Fix clearly.</p>
        </div>
      </aside>
    </>
  );
}
