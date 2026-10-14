"use client";

import { Droplets, MapPin, ShieldAlert, X } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { cn, formatAzn, formatHectares } from "@/lib/utils";

import { useArea } from "./api";
import { CompareButton } from "./compare-controls";

export const IRRIGATION_LABEL: Record<string, string> = {
  NONE: "Suvarma yoxdur",
  CANAL: "Kanal suvarması",
  WELL: "Subartezian quyusu",
  RIVER: "Çaydan suvarma"
};

/** Floating summary of the area picked on the map. */
export function SelectedAreaCard({
  code,
  onClose,
  className
}: {
  code: string;
  onClose: () => void;
  className?: string;
}) {
  const { data: area, isLoading } = useArea(code);

  return (
    <div className={cn("w-[340px] rounded-md border border-border bg-surface shadow-popover", className)}>
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-13 text-ink-3">{code}</div>
          {area ? <h2 className="truncate text-15">{area.name_az}</h2> : <Skeleton className="mt-1 h-5 w-48" />}
        </div>
        <button type="button" onClick={onClose} aria-label="Bağla" className="rounded p-1 text-ink-3 hover:bg-surface-2">
          <X className="size-4" />
        </button>
      </div>
      {isLoading || !area ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <PurposeChip purpose={area.purpose} />
            <span className="tabular text-sm font-medium">{formatHectares(Number(area.area_ha))}</span>
          </div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-ink-2">
              <MapPin className="size-4 shrink-0 text-ink-3" aria-hidden />
              <dd>
                {area.village_name ? `${area.village_name} kəndi, ` : ""}
                {area.rayon_name}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-ink-2">
              <Droplets className="size-4 shrink-0 text-ink-3" aria-hidden />
              <dd>{IRRIGATION_LABEL[area.irrigation]}</dd>
            </div>
            {area.demining_status !== "CLEARED" && (
              <div className="flex items-center gap-2 text-status-info-fg">
                <ShieldAlert className="size-4 shrink-0" aria-hidden />
                <dd>Minatəmizləmə davam edir (nümayiş): müsabiqəyə çıxarıla bilməz</dd>
              </div>
            )}
          </dl>
          {area.competition && (
            <div className="rounded-md bg-surface-2 px-3 py-2 text-13">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/competitions/${area.competition.number}`} className="font-mono font-medium text-primary hover:underline">
                  {area.competition.number}
                </Link>
                <DeadlineBadge iso={area.competition.deadline_at} />
              </div>
              {area.min_investment_azn && (
                <div className="mt-1 text-ink-2">Minimum investisiya: {formatAzn(Number(area.min_investment_azn))}</div>
              )}
            </div>
          )}
          <CompareButton code={code} className="w-full" />
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <Link href={`/areas/${code}`}>Ətraflı</Link>
            </Button>
            {area.competition?.is_open && (
              <Button asChild size="sm" className="flex-1">
                <Link href={`/cabinet/applications/new?area=${code}`}>Müraciət et</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
