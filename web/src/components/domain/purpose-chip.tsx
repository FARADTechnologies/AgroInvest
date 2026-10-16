"use client";

import { Apple, Beef, Shapes, Wheat } from "lucide-react";

import type { Purpose } from "@/lib/domain";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Fill colours for map layers; must match the purpose tokens in globals.css. */
export const PURPOSE_HEX: Record<Purpose, string> = {
  CROP: "#E2B234",
  LIVESTOCK: "#B06840",
  ORCHARD: "#60AA46",
  OTHER: "#6484A8"
};

export const PURPOSE_META: Record<Purpose, { icon: typeof Wheat; swatch: string }> = {
  CROP: { icon: Wheat, swatch: "bg-purpose-crop" },
  LIVESTOCK: { icon: Beef, swatch: "bg-purpose-livestock" },
  ORCHARD: { icon: Apple, swatch: "bg-purpose-orchard" },
  OTHER: { icon: Shapes, swatch: "bg-purpose-other" }
};

export function PurposeIcon({ purpose, className }: { purpose: Purpose; className?: string }) {
  const Icon = PURPOSE_META[purpose].icon;
  return <Icon className={cn("size-3.5", className)} aria-hidden />;
}

/** Purpose label with its map colour. Pass onToggle to use it as a filter chip. */
export function PurposeChip({
  purpose,
  count,
  selected,
  onToggle,
  className
}: {
  purpose: Purpose;
  count?: number;
  selected?: boolean;
  onToggle?: () => void;
  className?: string;
}) {
  const t = useT();
  const { swatch } = PURPOSE_META[purpose];
  const content = (
    <>
      <span className={cn("size-2 rounded-full", swatch)} aria-hidden />
      <PurposeIcon purpose={purpose} className="text-ink-2" />
      <span>{t.purpose[purpose]}</span>
      {count !== undefined && <span className="tabular text-ink-3">{count}</span>}
    </>
  );
  const base =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-13 font-medium transition-colors";
  if (!onToggle) {
    return <span className={cn(base, "border-border bg-surface text-ink", className)}>{content}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        base,
        selected
          ? "border-primary bg-primary text-primary-fg [&_svg]:text-accent"
          : "border-border bg-surface text-ink-2 hover:border-border-strong",
        className
      )}
    >
      {content}
    </button>
  );
}
