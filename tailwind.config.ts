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
        sans: ["ui-sans-serif", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // shadcn/ui CSS variable references (Notion-mapped)
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

        // Notion design system color tokens
        score: {
          good:     "#0F7B3D",
          warning:  "#C47A00",
          critical: "#C4342C",
        },
        // Semantic surface tokens
        surface: {
          DEFAULT:   "#FFFFFF",
          sidebar:   "#F7F7F5",
          hover:     "#F1F1EF",
          active:    "#EBEBEA",
          secondary: "#FAFAFA",
        },
        edge: {
          DEFAULT: "#E9E9E7",
          strong:  "#D0D0CD",
          hover:   "#D9D9D6",
        },
        fg: {
          DEFAULT:   "#37352F",
          secondary: "#787774",
          muted:     "#ACABA8",
          faint:     "#C9C9C6",
        },
        base: {
          DEFAULT: "#FFFFFF",
          dark:    "#37352F",
        },
        sidebar: {
          DEFAULT:    "#F7F7F5",
          border:     "#E9E9E7",
          fg:         "#37352F",
          "fg-muted": "#ACABA8",
          active:     "rgba(35,131,226,0.08)",
          hover:      "#EBEBEA",
        },
        // Notion blue accent
        brand: {
          DEFAULT: "#2383E2",
          light:   "#1d6fc2",
          dark:    "#1558a8",
          muted:   "rgba(35,131,226,0.10)",
          soft:    "rgba(35,131,226,0.06)",
        },
        // Glass helpers (for arbitrary value access)
        glass: {
          DEFAULT:        "#FFFFFF",
          hover:          "#F7F7F5",
          elevated:       "#FFFFFF",
          border:         "#E9E9E7",
          "border-hover": "#D9D9D6",
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
        glass:        "0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px #E9E9E7",
        "glass-lg":   "0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px #E9E9E7",
        "glow-green": "0 0 12px rgba(15,123,61,0.15)",
        "glow-amber": "0 0 12px rgba(196,122,0,0.15)",
        "glow-red":   "0 0 12px rgba(196,52,44,0.15)",
        "glow-brand": "0 0 12px rgba(35,131,226,0.2)",
        ring: "0 0 0 2px #FFFFFF, 0 0 0 4px rgba(35,131,226,0.4)",
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
