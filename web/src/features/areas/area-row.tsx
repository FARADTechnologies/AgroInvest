"use client";

import { Crosshair, ShieldAlert } from "lucide-react";
import { memo } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PURPOSE_HEX } from "@/components/domain/purpose-chip";
import { useL } from "@/lib/i18n";
import { cn, formatHectares } from "@/lib/utils";

import type { AreaListItem } from "./api";
import { AreaShape } from "./area-shape";

const FAO_TONE: Record<string, string> = {
  S1: "bg-suit-s1/15 text-status-won-fg",
  S2: "bg-suit-s2/20 text-accent-text",
  S3: "bg-suit-s3/25 text-status-info-fg",
  N: "bg-surface-2 text-ink-3"
};

/** One plot in the map's grouped list: outline thumbnail, code, place, size and competition state. */
export const AreaRow = memo(function AreaRow({
  area,
  geometry,
  selected,
  highlighted,
  onSelect,
  onHover
}: {
  area: AreaListItem;
  geometry?: GeoJSON.Geometry;
  selected?: boolean;
  highlighted?: boolean;
  onSelect?: (code: string) => void;
  onHover?: (code: string | null) => void;
}) {
  const L = useL();
  const color = PURPOSE_HEX[area.purpose];
  return (
    <button
      type="button"
      id={`area-row-${area.code}`}
      onClick={() => onSelect?.(area.code)}
      onMouseEnter={() => onHover?.(area.code)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(area.code)}
      onBlur={() => onHover?.(null)}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2 text-left transition-all duration-200",
        selected
          ? "border-primary/30 bg-primary-50 shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.15)]"
          : highlighted
            ? "border-white bg-white"
            : "border-transparent hover:border-white hover:bg-white"
      )}
    >
      <span
        className={cn(
          "relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#2E4A33] p-1.5 transition-transform duration-300 ease-spring group-hover:scale-105",
          selected && "ring-2 ring-accent ring-offset-2 ring-offset-primary-50"
        )}
      >
        {/* Field texture behind the outline. */}
        <span
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, #4E6B3F 0 3px, #3A5530 3px 7px)" }}
          aria-hidden
        />
        <AreaShape geometry={geometry} color={color} className="relative" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-13 font-medium text-ink">{area.code}</span>
          {area.best_fao_class && (
            <span className={cn("rounded-full px-1.5 font-mono text-2xs font-semibold leading-5", FAO_TONE[area.best_fao_class])}>
              {area.best_fao_class}
            </span>
          )}
        </span>
        <span className="block truncate text-13 text-ink-2">
          {area.village_name ? `${area.village_name}, ` : ""}
          {area.rayon_name}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="tabular text-13 font-semibold text-ink">{formatHectares(Number(area.area_ha))}</span>
          {area.demining_status !== "CLEARED" ? (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-status-info-fg">
              <ShieldAlert className="size-3" aria-hidden /> {L("Minatəmizləmə", "Demining")}
            </span>
          ) : area.competition ? (
            <DeadlineBadge iso={area.competition.deadline_at} className="text-2xs" />
          ) : (
            <span className="text-2xs text-ink-3">{L("Müsabiqədə deyil", "Not offered")}</span>
          )}
        </span>
      </span>
      <Crosshair
        className={cn(
          "size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100",
          selected && "text-primary opacity-100"
        )}
        aria-hidden
      />
    </button>
  );
});
