"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Sidebar handles both desktop fixed and mobile drawer */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* Mobile top bar — only visible on small screens */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 glass-sidebar border-b border-[var(--glass-border)] h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-[var(--text-primary)]">AgentGrade</span>
      </div>

      {/* Main content
          - On desktop: ml-64 to clear the fixed sidebar
          - On mobile: no left margin, but pt-14 to clear the top bar */}
      <main className="md:ml-64 p-6 md:p-8 pt-20 md:pt-8">
        {children}
      </main>
    </div>
  );
}
