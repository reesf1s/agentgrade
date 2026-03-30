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
        // shadcn/ui CSS variable references (Linear-mapped)
        background:  "hsl(var(--shadcn-background))",
        foreground:  "hsl(var(--shadcn-foreground))",
        card:        { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover:     { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary:     { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:   { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:      { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",

        // Linear design system color tokens
        score: {
          good:     "#4EA76B",
          warning:  "#D98832",
          critical: "#DC5B5B",
        },
        // Semantic surface tokens
        surface: {
          DEFAULT:   "#1C1C1E",
          secondary: "#222225",
          hover:     "#242428",
          active:    "#2A2A2E",
        },
        edge: {
          DEFAULT: "rgba(255,255,255,0.08)",
          strong:  "rgba(255,255,255,0.14)",
          hover:   "rgba(255,255,255,0.12)",
        },
        fg: {
          DEFAULT:   "rgba(255,255,255,0.92)",
          secondary: "rgba(255,255,255,0.48)",
          muted:     "rgba(255,255,255,0.28)",
          faint:     "rgba(255,255,255,0.14)",
        },
        base: {
          DEFAULT: "#161618",
          white:   "#FFFFFF",
        },
        sidebar: {
          DEFAULT:    "#1A1A1C",
          border:     "rgba(255,255,255,0.06)",
          fg:         "rgba(255,255,255,0.72)",
          "fg-muted": "rgba(255,255,255,0.3)",
          active:     "rgba(255,255,255,0.07)",
          hover:      "rgba(255,255,255,0.04)",
        },
        // Linear purple accent
        brand: {
          DEFAULT: "#5E6AD2",
          light:   "#7178E0",
          dark:    "#4D5AC0",
          muted:   "rgba(94,106,210,0.12)",
          soft:    "rgba(94,106,210,0.07)",
        },
        // Glass helpers (for arbitrary value access)
        glass: {
          DEFAULT: "#1C1C1E",
          hover:   "#212124",
          elevated:"#222225",
          border:  "rgba(255,255,255,0.08)",
          "border-hover": "rgba(255,255,255,0.14)",
        },
      },
      borderRadius: {
        "2xl": "10px",
        xl:    "8px",
        lg:    "var(--radius)",   // shadcn uses this
        md:    "5px",
        sm:    "4px",
      },
      boxShadow: {
        glass:     "0 1px 2px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
        "glass-lg":"0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)",
        "glow-green": "0 0 16px rgba(78,167,107,0.2)",
        "glow-amber": "0 0 16px rgba(217,136,50,0.2)",
        "glow-red":   "0 0 16px rgba(220,91,91,0.2)",
        "glow-brand": "0 0 16px rgba(94,106,210,0.25)",
        ring: "0 0 0 2px #161618, 0 0 0 4px rgba(94,106,210,0.5)",
      },
      animation: {
        "fade-in":        "fade-in 0.2s ease both",
        "fade-in-up":     "fade-in-up 0.25s ease both",
        "slide-in-right": "slide-in-right 0.2s cubic-bezier(0.16,1,0.3,1)",
        shimmer:          "shimmer 1.8s ease infinite",
        "pulse-soft":     "pulse-soft 2s ease infinite",
        "backdrop-in":    "backdrop-in 0.15s ease",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(3px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to:   { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%":      { opacity: "1" },
        },
        "backdrop-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
