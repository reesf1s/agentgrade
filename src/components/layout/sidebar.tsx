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
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Operate",
    items: [
      { href: "/dashboard",     label: "Overview",      icon: Layers        },
      { href: "/conversations", label: "Conversations", icon: MessageSquare },
      { href: "/patterns",      label: "Issues",        icon: Sparkles      },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/reports",    label: "Reports",    icon: FileBarChart },
      { href: "/benchmarks", label: "Benchmarks", icon: BarChart3    },
    ],
  },
  {
    label: "Configure",
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
        "flex items-center gap-2.5 px-3 py-1.5 rounded-[6px] text-[13px] transition-all duration-100",
        isActive
          ? "bg-[#F0F7FF] text-[#1A6BB5] font-medium"
          : "text-[#6B6B67] hover:bg-[#F1F1EF] hover:text-[#37352F] font-normal"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-[#2383E2]" : "text-[#ACABA8]"
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
    for (const section of navSections) {
      for (const item of section.items) {
        router.prefetch(item.href);
      }
    }
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const SidebarInner = () => (
    <div className="flex h-full flex-col bg-white border-r border-[#E9E9E7]">
      {/* Logo area */}
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4 border-b border-[#E9E9E7]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#2383E2]">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#37352F]">
            AgentGrade
          </p>
          <p className="truncate text-[11px] text-[#ACABA8]">My Workspace</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {navSections.map((section, i) => (
          <div key={section.label} className={i > 0 ? "mt-5" : ""}>
            <p className="mb-1 px-3 text-[10px] font-medium tracking-[0.1em] uppercase text-[#ACABA8]">
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
      <div className="shrink-0 border-t border-[#E9E9E7] px-5 py-3">
        <p className="text-[11px] text-[#ACABA8]">v1.0</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div
        className="fixed left-0 right-0 top-0 z-50 flex h-[52px] items-center justify-between px-4 lg:hidden"
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E9E9E7",
        }}
      >
        <Link href="/dashboard" prefetch className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2383E2]">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L10.5 6H14L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L2 6H5.5L8 1Z" fill="white" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold text-[#37352F]">AgentGrade</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-1.5 text-[#6B6B67] transition-colors hover:bg-[#F1F1EF] hover:text-[#37352F]"
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
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col transition-transform duration-200 ease-out",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarInner />
      </aside>
    </>
  );
}
