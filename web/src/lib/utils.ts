import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our custom font sizes must be known to tailwind-merge; otherwise "text-13" is
// mistaken for a colour and silently removes "text-primary-fg" from buttons.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["2xs", "13", "15"] }] } }
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BAKU_TZ = "Asia/Baku";

// Azerbaijani number style (space groups, decimal comma) written out by hand:
// browsers do not all ship az-AZ locale data, and the fallback would show 160,000.
function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [int, frac] = fixed.split(".");
  return `${value < 0 ? "−" : ""}${groupThousands(int)}${frac ? `,${frac}` : ""}`;
}

function bakuParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { d: get("day"), m: get("month"), y: get("year"), h: get("hour"), min: get("minute") };
}

/** Baku local date, e.g. 05.11.2026. */
export function formatDate(iso: string): string {
  const { d, m, y } = bakuParts(iso);
  return `${d}.${m}.${y}`;
}

/** Baku local date and time, e.g. 05.11.2026 23:59. */
export function formatDateTime(iso: string): string {
  const { d, m, y, h, min } = bakuParts(iso);
  return `${d}.${m}.${y} ${h}:${min}`;
}

/** Hectares with one decimal: 42,6 ha. */
export function formatHectares(value: number): string {
  return `${formatNumber(value, 1)} ha`;
}

/** Money in manat. The ₼ glyph is missing from the UI font, so "AZN" is written out. */
export function formatAzn(value: number): string {
  return `${formatNumber(Math.round(value))} AZN`;
}

/** Whole days left until a deadline; negative once it has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
