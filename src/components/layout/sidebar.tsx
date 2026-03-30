"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import {
  BarChart3,
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
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  section?: string;
}

const navItems: NavItem[] = [
  { href: "/dashboard",     label: "Overview",     icon: Layers,        section: "operate" },
  { href: "/conversations", label: "Review queue", icon: MessageSquare, section: "operate" },
  { href: "/patterns",      label: "Issues",       icon: Sparkles,      section: "operate" },
  { href: "/reports",       label: "Reports",      icon: FileBarChart,  section: "learn" },
  { href: "/benchmarks",    label: "Benchmarks",   icon: BarChart3,     section: "learn" },
  { href: "/settings",      label: "Setup",        icon: Settings,      section: "configure" },
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
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
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
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-all duration-100",
        isActive
          ? "bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.9)] font-medium"
          : "text-[rgba(255,255,255,0.48)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.72)] font-normal"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-[#5E6AD2]" />
      )}
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          isActive
            ? "text-[rgba(255,255,255,0.6)]"
            : "text-[rgba(255,255,255,0.28)] group-hover:text-[rgba(255,255,255,0.5)]"
        )}
      />
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
    { key: "operate",   label: "Operate",   items: navItems.filter((i) => i.section === "operate") },
    { key: "learn",     label: "Learn",     items: navItems.filter((i) => i.section === "learn") },
    { key: "configure", label: "Configure", items: navItems.filter((i) => i.section === "configure") },
  ];

  const SidebarInner = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#5E6AD2]">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[rgba(255,255,255,0.9)]">
            AgentGrade
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {sections.map((section, i) => (
          <div key={section.key} className={i > 0 ? "mt-5" : ""}>
            <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[rgba(255,255,255,0.2)]">
              {section.label}
            </p>
            <div className="space-y-px">
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

      {/* Footer */}
      <div className="mx-2.5 mt-auto border-t border-[rgba(255,255,255,0.06)] pb-4 pt-3">
        <p className="px-2.5 text-[11px] text-[rgba(255,255,255,0.18)]">v1.0</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 lg:hidden"
        style={{
          background: "#1A1A1C",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Link href="/dashboard" prefetch className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5E6AD2]">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-[rgba(255,255,255,0.9)]">AgentGrade</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-1.5 text-[rgba(255,255,255,0.4)] transition-colors hover:text-[rgba(255,255,255,0.7)]"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 animate-backdrop-in lg:hidden"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "glass-sidebar fixed inset-y-0 left-0 z-50 flex w-[14rem] flex-col transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarInner />
      </aside>
    </>
  );
}
