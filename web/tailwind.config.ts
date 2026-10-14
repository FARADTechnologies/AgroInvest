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
          text: token("accent-text"),
          50: token("accent-50")
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
      fontSize: {
        "2xs": ["11px", "16px"],
        13: ["13px", "18px"],
        15: ["15px", "22px"]
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "4px",
        md: "var(--radius)",
        lg: "8px"
      },
      boxShadow: {
        popover: "0 8px 24px rgb(29 31 27 / 0.12), 0 1px 3px rgb(29 31 27 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
