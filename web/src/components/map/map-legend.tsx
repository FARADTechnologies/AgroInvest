"use client";

import { AnimatePresence, motion } from "motion/react";

import { PURPOSE_HEX } from "@/components/domain/purpose-chip";
import { EASE } from "@/components/ui/motion";
import { FAO_CLASSES, PURPOSES } from "@/lib/domain";
import { useL, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { SUIT_HEX } from "./farm-map";

export function MapLegend({ mode, className }: { mode: "purpose" | "suitability"; className?: string }) {
  const t = useT();
  const L = useL();
  return (
    <div className={cn("glass rounded-2xl px-3.5 py-3 text-13", className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ul
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="space-y-1.5"
        >
          {mode === "purpose"
            ? PURPOSES.map((p) => (
                <li key={p} className="flex items-center gap-2 font-medium">
                  <span className="size-3 rounded-full ring-2 ring-white" style={{ background: PURPOSE_HEX[p] }} aria-hidden />
                  {t.purpose[p]}
                </li>
              ))
            : FAO_CLASSES.map((c) => (
                <li key={c} className="flex items-center gap-2 font-medium">
                  <span className="size-3 rounded-full ring-2 ring-white" style={{ background: SUIT_HEX[c] }} aria-hidden />
                  <span className="font-mono text-ink-2">{c}</span> {t.suitability[c]}
                </li>
              ))}
        </motion.ul>
      </AnimatePresence>
      <div className="mt-2.5 space-y-1 border-t border-ink/10 pt-2 text-2xs text-ink-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-ink-2/60" aria-hidden /> {L("Açıq müsabiqədə", "Open competition")}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full bg-ink-2/25" aria-hidden /> {L("Müsabiqədə deyil", "Not offered")}
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-full border border-dashed border-status-info-fg" aria-hidden /> {L("Minatəmizləmə", "Demining")}
        </div>
      </div>
    </div>
  );
}
