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
    title: "Monitor",
    items: [
      { href: "/dashboard",      label: "Overview",      icon: LayoutDashboard },
      { href: "/conversations",  label: "Review queue",  icon: MessageSquare },
      { href: "/reports",        label: "Reports",       icon: FileBarChart },
      { href: "/patterns",       label: "Issues",        icon: Sparkles },
      { href: "/benchmarks",     label: "Benchmarks",    icon: BarChart3 },
    ],
  },
  {
    title: "Configure",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
    ],
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
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all",
        isActive
          ? "bg-[var(--sidebar-accent-bg)] text-[var(--sidebar-accent-fg)] font-semibold"
          : "font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[var(--sidebar-accent-fg)]" : "text-[var(--text-muted)]")} />
      <span className="flex-1">{label}</span>
      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--sidebar-accent-fg)]" />}
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

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--btn-primary-bg)]">
          <Zap className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] truncate">
            AgentGrade
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Quality operations</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.title} className="mb-3">
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
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
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--panel)] px-4 py-3 lg:hidden">
        <Link href="/dashboard" prefetch className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-primary-bg)]">
            <Zap className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">AgentGrade</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-1.5 text-[var(--text-primary)]"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[13.5rem] flex-col bg-[var(--panel)] border-r border-[var(--border-subtle)] transition-transform duration-200",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
