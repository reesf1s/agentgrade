"use client";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[var(--surface-hover)]"
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
      ) : (
        <Sun className="w-4 h-4 text-[var(--text-secondary)]" />
      )}
    </button>
  );
}
