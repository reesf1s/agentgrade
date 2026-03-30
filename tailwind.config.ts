import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "monospace"],
      },
      colors: {
        // Brand
        brand: {
          DEFAULT: "#6366F1",
          light: "#818CF8",
          muted: "rgba(99,102,241,0.15)",
        },
        // Score semantic colors
        score: {
          good: "#10B981",
          warning: "#F59E0B",
          critical: "#EF4444",
        },
        // Surface system
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          hover: "rgba(255,255,255,0.055)",
          active: "rgba(255,255,255,0.07)",
          raised: "#111118",
          elevated: "rgba(255,255,255,0.05)",
        },
        // Borders
        edge: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.12)",
          hover: "rgba(255,255,255,0.10)",
        },
        // Text
        fg: {
          DEFAULT: "rgba(255,255,255,0.92)",
          secondary: "rgba(255,255,255,0.55)",
          muted: "rgba(255,255,255,0.35)",
          faint: "rgba(255,255,255,0.20)",
        },
        // Background
        base: {
          DEFAULT: "#0A0A0F",
          raised: "#111118",
        },
      },
      borderRadius: {
        "2xl": "12px",
        xl: "10px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        glass: "0 1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15)",
        "glass-hover": "0 4px 16px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)",
        "glass-elevated": "0 8px 32px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)",
        "glow-brand": "0 0 20px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.05)",
        "glow-sm": "0 0 10px rgba(99,102,241,0.10)",
      },
      animation: {
        "fade-in": "fade-in 0.35s ease both",
        "fade-in-up": "fade-in-up 0.4s ease both",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-bottom": "slide-in-bottom 0.3s cubic-bezier(0.16,1,0.3,1)",
        shimmer: "shimmer 1.8s ease infinite",
        "pulse-soft": "pulse-soft 2s ease infinite",
        "scale-in": "scale-in 0.2s ease",
        "backdrop-in": "backdrop-in 0.2s ease",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-bottom": {
          from: { opacity: "0", transform: "translateY(100%)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
