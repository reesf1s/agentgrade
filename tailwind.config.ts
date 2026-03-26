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
        sans: ["Inter", "var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "monospace"],
      },
      colors: {
        score: {
          good: "#10B981",
          warning: "#F59E0B",
          critical: "#EF4444",
        },
      },
      boxShadow: {
        glass: "0 4px 24px rgba(0,0,0,0.04)",
        "glass-elevated": "0 8px 32px rgba(0,0,0,0.06)",
        "glass-lg": "0 12px 40px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
