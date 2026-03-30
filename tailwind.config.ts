import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "monospace"],
      },
      colors: {
        brand: {
          DEFAULT: "#6366F1",
          light: "#818CF8",
          dark: "#4F46E5",
          muted: "rgba(99,102,241,0.08)",
          soft: "rgba(99,102,241,0.05)",
        },
        score: {
          good: "#10B981",
          warning: "#F59E0B",
          critical: "#EF4444",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F8F9FC",
          hover: "#F3F4F8",
          active: "#ECEDF3",
        },
        edge: {
          DEFAULT: "rgba(0,0,0,0.08)",
          strong: "rgba(0,0,0,0.14)",
          hover: "rgba(0,0,0,0.12)",
        },
        fg: {
          DEFAULT: "#111827",
          secondary: "#6B7280",
          muted: "#9CA3AF",
          faint: "#D1D5DB",
        },
        base: {
          DEFAULT: "#F8F9FC",
          white: "#FFFFFF",
        },
      },
      borderRadius: {
        "2xl": "16px",
        xl: "12px",
        lg: "8px",
        md: "6px",
        sm: "4px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        elevated: "0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        "glow-brand": "0 0 20px rgba(99,102,241,0.12)",
        "glow-sm": "0 0 10px rgba(99,102,241,0.08)",
        ring: "0 0 0 2px #FFFFFF, 0 0 0 4px rgba(99,102,241,0.4)",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease both",
        "fade-in-up": "fade-in-up 0.4s ease both",
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1)",
        shimmer: "shimmer 1.8s ease infinite",
        "pulse-soft": "pulse-soft 2s ease infinite",
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
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
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
