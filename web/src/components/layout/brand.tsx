"use client";

import Link from "next/link";

import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The Agro Invest logo: a leaf with a sprout and a rising sun (public/logo.png, transparent). */
export function BrandMark({ className }: { className?: string; tone?: "dark" | "lime" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static PNG; next/image adds nothing here
    <img src="/logo.png" alt="" width={36} height={36} className={cn("size-9 shrink-0 object-contain", className)} aria-hidden />
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
    <Link href={href} className={cn("group flex items-center gap-2.5", className)} aria-label="Agro Invest">
      <BrandMark tone={light ? "lime" : "dark"} className="transition-transform duration-300 ease-spring group-hover:rotate-[-6deg] group-hover:scale-105" />
      {!compact && (
        <span className={cn("leading-tight", light ? "text-white" : "text-ink")}>
          <span className="block text-15 font-semibold tracking-[-0.01em]">Agro Invest</span>
          <span className={cn("block text-2xs font-medium uppercase tracking-[0.14em]", light ? "text-white/55" : "text-ink-3")}>
            {L("İnvestisiya portalı · Prototip", "Investment portal · Prototype")}
          </span>
        </span>
      )}
    </Link>
  );
}
