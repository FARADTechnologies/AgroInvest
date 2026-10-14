import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BAKU_TZ = "Asia/Baku";

/** Formats a UTC timestamp as Baku local date and time, e.g. 05.11.2026 23:59. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("az-AZ", {
    timeZone: BAKU_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("az-AZ", {
    timeZone: BAKU_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(iso));
}

/** Hectares with one decimal and an Azerbaijani decimal comma: 42,6 ha. */
export function formatHectares(value: number): string {
  return `${value.toLocaleString("az-AZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ha`;
}

/** Money in manat. The ₼ glyph is missing from the UI font, so "AZN" is written out. */
export function formatAzn(value: number): string {
  return `${Math.round(value).toLocaleString("az-AZ")} AZN`;
}

/** Whole days left until a deadline; negative once it has passed. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}
