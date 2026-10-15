"use client";

import { Layers } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { PURPOSE_HEX, PURPOSE_META } from "@/components/domain/purpose-chip";
import { EASE } from "@/components/ui/motion";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { useL, useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { CROP_META, CROPS_BY_PURPOSE, type CropKey } from "./crops";

/**
 * "Hamısı · Əkinçilik · Bağçılıq · Heyvandarlıq · Digər" as one segmented control.
 * Picking a purpose narrows the map and the list to it; the pill glides between tabs.
 */
export function PurposeTabs({
  value,
  onChange,
  counts,
  className
}: {
  value: Purpose[];
  onChange: (next: Purpose[]) => void;
  counts?: Record<string, number>;
  className?: string;
}) {
  const t = useT();
  const L = useL();
  const active = value.length === 1 ? value[0] : value.length === 0 ? "ALL" : "MANY";
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : undefined;
  const tabs: { key: Purpose | "ALL"; label: string; count?: number }[] = [
    { key: "ALL", label: L("Hamısı", "All"), count: total },
    ...PURPOSES.map((p) => ({ key: p, label: t.purpose[p], count: counts?.[p] ?? 0 }))
  ];

  return (
    <div role="tablist" aria-label={L("Təyinat", "Purpose")} className={cn("scrollbar-thin -mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-ink/[0.04] p-1", className)}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        const Icon = tab.key === "ALL" ? Layers : PURPOSE_META[tab.key].icon;
        const color = tab.key === "ALL" ? undefined : PURPOSE_HEX[tab.key];
        const empty = tab.count === 0 && !selected;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={empty}
            onClick={() => onChange(tab.key === "ALL" ? [] : [tab.key])}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-13 font-medium transition-colors disabled:opacity-40",
              selected ? "text-primary-fg" : "text-ink-2 hover:text-ink"
            )}
          >
            {selected && (
              <motion.span
                layoutId="purpose-tab"
                className="absolute inset-0 rounded-xl bg-primary shadow-[0_6px_14px_-6px_rgb(19_67_47/0.7)]"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
              />
            )}
            <Icon className="relative size-4" style={selected ? { color: "rgb(var(--accent))" } : color ? { color } : undefined} aria-hidden />
            <span className="relative whitespace-nowrap">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn("relative rounded-full px-1.5 text-2xs font-semibold leading-[18px] tabular", selected ? "bg-white/15 text-white" : "bg-white text-ink-3")}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Second row that appears when one purpose is picked: its crop types
 * (Əkinçilik → Taxıl · Arpa · Yonca). Slides in and out with the purpose.
 */
export function CropTabs({
  purpose,
  value,
  onChange,
  counts
}: {
  purpose: Purpose | null;
  value: CropKey | null;
  onChange: (next: CropKey | null) => void;
  counts: Partial<Record<CropKey, number>>;
}) {
  const L = useL();
  const { lang } = useLang();
  return (
    <AnimatePresence initial={false}>
      {purpose && (
        <motion.div
          key={purpose}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label={L("Bitki növü", "Crop type")}>
            <button
              type="button"
              role="tab"
              aria-selected={value === null}
              onClick={() => onChange(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-13 font-medium transition-all",
                value === null ? "border-primary bg-primary-50 text-primary" : "border-white/70 bg-white/60 text-ink-2 hover:bg-white"
              )}
            >
              {L("Bütün növlər", "All types")}
            </button>
            {CROPS_BY_PURPOSE[purpose].map((crop, i) => {
              const meta = CROP_META[crop];
              const Icon = meta.icon;
              const selected = value === crop;
              const n = counts[crop] ?? 0;
              return (
                <motion.button
                  key={crop}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={n === 0 && !selected}
                  onClick={() => onChange(selected ? null : crop)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + i * 0.05 }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-13 font-medium transition-all disabled:opacity-40",
                    selected ? "text-white shadow-card" : "border-white/70 bg-white/60 text-ink-2 hover:bg-white"
                  )}
                  style={selected ? { background: meta.color, borderColor: meta.color } : undefined}
                >
                  <Icon className="size-3.5" style={selected ? undefined : { color: meta.color }} aria-hidden />
                  {lang === "en" ? meta.en : meta.az}
                  <span className={cn("rounded-full px-1.5 text-2xs font-semibold tabular", selected ? "bg-white/20" : "bg-white text-ink-3")}>{n}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
