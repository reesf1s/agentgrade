"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  LayoutDashboard, MessageSquare, FileBarChart,
  AlertTriangle, BarChart3, Settings, Zap, User, X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",      label: "Dashboard",    icon: LayoutDashboard },
  { href: "/conversations",  label: "Conversations", icon: MessageSquare },
  { href: "/reports",        label: "Reports",       icon: FileBarChart },
  { href: "/patterns",       label: "Patterns",      icon: AlertTriangle },
  { href: "/benchmarks",     label: "Benchmarks",    icon: BarChart3 },
  { href: "/settings",       label: "Settings",      icon: Settings },
];

interface SidebarProps {
  // When provided, mobile drawer is controlled externally (from DashboardLayout)
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <>
      {/* Logo */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onMobileClose}>
          <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[var(--background)]" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            AgentGrade
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {/* Close button — only shown on mobile */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
              )}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Workspace / user footer */}
      <div className="p-4 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">My Workspace</p>
            <p className="text-xs text-[var(--text-muted)]">Starter Plan</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible on md+) ── */}
      <aside className="glass-sidebar w-64 h-screen flex flex-col fixed left-0 top-0 z-40 hidden md:flex">
        {navContent}
      </aside>

      {/* ── Mobile drawer ── */}
      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}
      {/* Drawer */}
      <aside
        className={cn(
          "md:hidden glass-sidebar w-64 h-screen flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
