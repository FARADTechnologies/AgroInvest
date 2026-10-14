"use client";

import { PURPOSE_HEX } from "@/components/domain/purpose-chip";
import { FAO_CLASSES, PURPOSES } from "@/lib/domain";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SUIT_HEX = { S1: "#2F7A4A", S2: "#8DAF4E", S3: "#D9B547", N: "#B9B3A6" };

export function MapLegend({ mode, className }: { mode: "purpose" | "suitability"; className?: string }) {
  const t = useT();
  return (
    <div className={cn("rounded-md border border-border bg-surface/95 px-3 py-2 text-13 shadow-popover", className)}>
      <ul className="space-y-1">
        {mode === "purpose"
          ? PURPOSES.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="size-3 rounded-[2px]" style={{ background: PURPOSE_HEX[p] }} aria-hidden />
                {t.purpose[p]}
              </li>
            ))
          : FAO_CLASSES.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="size-3 rounded-[2px]" style={{ background: SUIT_HEX[c] }} aria-hidden />
                <span className="font-mono">{c}</span> {t.suitability[c]}
              </li>
            ))}
      </ul>
      <div className="mt-2 space-y-1 border-t border-border pt-2 text-2xs text-ink-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] bg-ink-2/60" aria-hidden /> Açıq müsabiqədə
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] bg-ink-2/25" aria-hidden /> Müsabiqədə deyil
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-[2px] border border-dashed border-status-info-fg" aria-hidden /> Minatəmizləmə davam edir
        </div>
        <p className="max-w-[200px] text-ink-3">Minatəmizləmə statusları nümayiş məqsədlidir.</p>
      </div>
    </div>
  );
}
