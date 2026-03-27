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
    <aside className="glass-sidebar w-64 h-screen flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[var(--background)]" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            AgentGrade
          </span>
        </Link>
        <ThemeToggle />
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
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-[var(--surface-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-[var(--glass-border)]">
        <UserButton
          appearance={{
            elements: {
              userButtonBox: "flex items-center gap-3 w-full",
              userButtonTrigger: "flex items-center gap-3 w-full rounded-xl p-1 hover:bg-[var(--surface)] transition-all",
              userButtonAvatarBox: "w-8 h-8",
              userButtonOuterIdentifier: "text-sm font-medium text-[var(--text-primary)] truncate",
            },
          }}
          showName
        />
      </div>
    </aside>
  );
}
