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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/reports",        label: "This week",      icon: FileBarChart },
  { href: "/conversations",  label: "Conversations",  icon: MessageSquare },
  { href: "/patterns",       label: "Patterns",       icon: Sparkles },
  { href: "/dashboard",      label: "Overview",       icon: Layers },
  { href: "/settings",       label: "Settings",       icon: Settings },
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
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all",
        isActive
          ? "bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.90)] font-semibold"
          : "font-medium text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.70)]"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[rgba(255,255,255,0.70)]" : "text-[rgba(255,255,255,0.25)]")} />
      <span className="flex-1">{label}</span>
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

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.06)]">
          <Zap className="h-3.5 w-3.5 text-[rgba(255,255,255,0.50)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-[-0.02em] text-[rgba(255,255,255,0.85)] truncate">
            AgentGrade
          </p>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-[rgba(255,255,255,0.04)]" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-0.5">
          {navItems.map((item) => (
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
      </nav>

      {/* Bottom — version */}
      <div className="px-4 py-3 border-t border-[rgba(255,255,255,0.04)]">
        <p className="text-[10px] text-[rgba(255,255,255,0.20)]">v0.1 beta</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(10,10,15,0.95)] backdrop-blur-xl px-4 py-3 lg:hidden">
        <Link href="/reports" prefetch className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(255,255,255,0.06)]">
            <Zap className="h-3 w-3 text-[rgba(255,255,255,0.50)]" />
          </div>
          <span className="text-sm font-semibold text-[rgba(255,255,255,0.85)]">AgentGrade</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] p-1.5 text-[rgba(255,255,255,0.60)]"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[13.5rem] flex-col bg-[rgba(255,255,255,0.02)] border-r border-[rgba(255,255,255,0.04)] transition-transform duration-200",
          "lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
