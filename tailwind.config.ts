import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#E9EEE5",
        foreground: "#243B30",
        muted: "#69766C",
        primary: {
          DEFAULT: "#243B30",
          dark: "#1A2E25",
          light: "#2F4D3F",
          hover: "#1D3228",
        },
        accent: {
          DEFAULT: "#D96F50",
          hover: "#C55E40",
          light: "#FDF0EB",
          subtle: "#F8DDD4",
        },
        card: "#FAFAF6",
        input: "#F5F7F1",
        border: "#D5DED3",
        secondary: {
          DEFAULT: "#D5DED3",
          light: "#E4EBE2",
          dark: "#BCC7B9",
        },
        activeNav: "#294638",
        inactiveIcon: "#78867B",
        cream: {
          50: "#FAFAF6",
          100: "#F5F7F1",
          200: "#E9EEE5",
          300: "#D5DED3",
        },
        charcoal: {
          DEFAULT: "#243B30",
          light: "#3A4D43",
          dark: "#1A2E25",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        heading: ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        display: ["var(--font-cormorant)", "Cormorant Garamond", "Georgia", "serif"],
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        body: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        editorial: "0 2px 10px rgba(36, 59, 48, 0.05), 0 1px 3px rgba(36, 59, 48, 0.03)",
        "editorial-hover": "0 8px 24px rgba(36, 59, 48, 0.08), 0 2px 6px rgba(36, 59, 48, 0.04)",
        "editorial-lg": "0 14px 36px rgba(36, 59, 48, 0.10), 0 4px 12px rgba(36, 59, 48, 0.05)",
      },
      borderRadius: {
        editorial: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
