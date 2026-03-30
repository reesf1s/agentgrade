"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  FileBarChart,
  Layers,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  section?: string;
}

const navItems: NavItem[] = [
  { href: "/reports",       label: "This week",     icon: FileBarChart, section: "monitor" },
  { href: "/conversations", label: "Conversations",  icon: MessageSquare, section: "monitor" },
  { href: "/patterns",      label: "Patterns",       icon: Sparkles, section: "analyze" },
  { href: "/dashboard",     label: "Overview",       icon: Layers, section: "analyze" },
  { href: "/settings",      label: "Settings",       icon: Settings, section: "configure" },
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
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-all duration-150",
        isActive
          ? "bg-brand-muted text-brand font-semibold"
          : "text-fg-secondary hover:bg-surface-hover hover:text-fg font-medium"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-brand" />
      )}
      <Icon className={cn(
        "h-4 w-4 shrink-0 transition-colors",
        isActive ? "text-brand" : "text-fg-muted group-hover:text-fg-secondary"
      )} />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

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

  const sections = [
    { key: "monitor", items: navItems.filter((i) => i.section === "monitor") },
    { key: "analyze", items: navItems.filter((i) => i.section === "analyze") },
    { key: "configure", items: navItems.filter((i) => i.section === "configure") },
  ];

  const SidebarInner = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand shadow-glow-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
          </svg>
        </div>
        <p className="text-[15px] font-bold tracking-[-0.02em] text-fg truncate">
          AgentGrade
        </p>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
        {sections.map((section, i) => (
          <div key={section.key}>
            {i > 0 && <div className="mx-1 my-2.5 border-t border-edge" />}
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
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-edge bg-base-white/90 backdrop-blur-xl px-4 py-3 lg:hidden">
        <Link href="/reports" prefetch className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
            </svg>
          </div>
          <span className="text-sm font-bold text-fg">AgentGrade</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg border border-edge bg-surface p-1.5 text-fg-muted transition-colors hover:text-fg-secondary"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-backdrop-in lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[14rem] flex-col bg-base-white border-r border-edge transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarInner />
      </aside>
    </>
  );
}
