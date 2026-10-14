"use client";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeIcon } from "@/components/domain/purpose-chip";
import { useT } from "@/lib/i18n";
import { cn, formatHectares } from "@/lib/utils";

import type { AreaListItem } from "./api";

const SWATCH: Record<string, string> = {
  CROP: "bg-purpose-crop",
  LIVESTOCK: "bg-purpose-livestock",
  ORCHARD: "bg-purpose-orchard",
  OTHER: "bg-purpose-other"
};

/** Compact result row used in the map's side list. */
export function AreaRow({
  area,
  selected,
  onSelect,
  onHover
}: {
  area: AreaListItem;
  selected?: boolean;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0",
        selected ? "bg-primary-50" : "hover:bg-surface-2"
      )}
    >
      <span className={cn("mt-1 h-9 w-1 shrink-0 rounded-full", SWATCH[area.purpose])} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-13 font-medium text-ink">{area.code}</span>
          <span className="flex items-center gap-1 text-13 text-ink-2">
            <PurposeIcon purpose={area.purpose} />
            {t.purpose[area.purpose]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink">
          {area.village_name ? `${area.village_name}, ` : ""}
          {area.rayon_name}
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="tabular text-13 text-ink-2">
            {formatHectares(Number(area.area_ha))}
            {area.best_fao_class ? ` · ${area.best_fao_class}` : ""}
          </span>
          {area.demining_status !== "CLEARED" ? (
            <span className="text-13 text-status-info-fg">Minatəmizləmə</span>
          ) : area.competition ? (
            <DeadlineBadge iso={area.competition.deadline_at} />
          ) : (
            <span className="text-13 text-ink-3">Müsabiqəyə çıxarılmayıb</span>
          )}
        </span>
      </span>
    </button>
  );
}
