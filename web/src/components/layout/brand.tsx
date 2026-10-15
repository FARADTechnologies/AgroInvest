"use client";

import Link from "next/link";

import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Field furrows: a neutral mark, deliberately not a state emblem. */
export function BrandMark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "lime" }) {
  const bg = tone === "lime" ? "rgb(var(--accent))" : "rgb(var(--primary))";
  const ink = tone === "lime" ? "rgb(var(--primary))" : "#fff";
  const furrow = tone === "lime" ? "rgb(var(--primary))" : "rgb(var(--accent))";
  return (
    <svg viewBox="0 0 32 32" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="10" fill={bg} />
      <path d="M7 22c4-2.6 6.6-2.6 9 0s5.4 2.6 9 0" stroke={furrow} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M7 16c4-2.6 6.6-2.6 9 0s5.4 2.6 9 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".92" />
      <path d="M7 10c4-2.6 6.6-2.6 9 0s5.4 2.6 9 0" stroke={ink} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".5" />
    </svg>
  );
}

export function Brand({
  className,
  light = false,
  compact = false,
  href = "/"
}: {
  className?: string;
  light?: boolean;
  compact?: boolean;
  href?: string;
}) {
  const L = useL();
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)} aria-label="Aqrar İnvestisiya Portalı">
      <BrandMark tone={light ? "lime" : "dark"} className="transition-transform duration-300 ease-spring group-hover:rotate-[-6deg] group-hover:scale-105" />
      {!compact && (
        <span className={cn("leading-tight", light ? "text-white" : "text-ink")}>
          <span className="block text-15 font-semibold tracking-[-0.01em]">{L("Aqrar İnvestisiya", "Agri Investment")}</span>
          <span className={cn("block text-2xs font-medium uppercase tracking-[0.14em]", light ? "text-white/55" : "text-ink-3")}>
            {L("Portalı · Prototip", "Portal · Prototype")}
          </span>
        </span>
      )}
    </Link>
  );
}
