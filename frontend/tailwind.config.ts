import type { Config } from "tailwindcss";

/**
 * 设计令牌统一在此注册。
 *
 * 颜色使用 `rgb(var(--x) / <alpha-value>)` 形式，
 * 这样 Tailwind 的透明度修饰符（如 bg-surface/80）才能真正生效。
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--bg) / <alpha-value>)",
        foreground: "rgb(var(--fg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        brand: {
          red: "rgb(var(--mcd-red) / <alpha-value>)",
          yellow: "rgb(var(--mcd-yellow) / <alpha-value>)",
          orange: "rgb(var(--mcd-orange) / <alpha-value>)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.08)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        breathe: "breathe 6s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
