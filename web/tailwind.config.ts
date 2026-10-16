import type { Config } from "tailwindcss";

// Every colour is a CSS variable defined once in globals.css, so a restyle only
// touches the tokens. Channels are stored as "R G B" to keep opacity modifiers.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        border: token("border"),
        "border-strong": token("border-strong"),
        ink: {
          DEFAULT: token("text"),
          2: token("text-2"),
          3: token("text-3")
        },
        primary: {
          DEFAULT: token("primary"),
          hover: token("primary-hover"),
          50: token("primary-50"),
          100: token("primary-100"),
          fg: token("primary-fg")
        },
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          text: token("accent-text"),
          50: token("accent-50")
        },
        side: {
          DEFAULT: token("side"),
          2: token("side-2")
        },
        danger: {
          DEFAULT: token("danger"),
          50: token("danger-50")
        },
        status: {
          "draft-fg": token("status-draft-fg"),
          "draft-bg": token("status-draft-bg"),
          "received-fg": token("status-received-fg"),
          "received-bg": token("status-received-bg"),
          "review-fg": token("status-review-fg"),
          "review-bg": token("status-review-bg"),
          "info-fg": token("status-info-fg"),
          "info-bg": token("status-info-bg"),
          "won-fg": token("status-won-fg"),
          "won-bg": token("status-won-bg"),
          "rejected-fg": token("status-rejected-fg"),
          "rejected-bg": token("status-rejected-bg")
        },
        purpose: {
          crop: token("purpose-crop"),
          livestock: token("purpose-livestock"),
          orchard: token("purpose-orchard"),
          other: token("purpose-other")
        },
        suit: {
          s1: token("suit-s1"),
          s2: token("suit-s2"),
          s3: token("suit-s3"),
          n: token("suit-n")
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Noto Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      fontSize: {
        "2xs": ["11px", "16px"],
        13: ["13px", "18px"],
        15: ["15px", "22px"]
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "6px",
        md: "var(--radius)",
        lg: "14px",
        xl: "18px",
        "2xl": "22px",
        "3xl": "28px"
      },
      boxShadow: {
        popover: "0 12px 32px -8px rgb(10 30 21 / 0.18), 0 2px 6px rgb(10 30 21 / 0.06)",
        card: "0 1px 2px rgb(10 30 21 / 0.04), 0 8px 24px -16px rgb(10 30 21 / 0.12)",
        float: "0 20px 50px -20px rgb(10 30 21 / 0.45), 0 4px 12px -4px rgb(10 30 21 / 0.12)",
        glow: "0 0 0 6px rgb(198 243 107 / 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
