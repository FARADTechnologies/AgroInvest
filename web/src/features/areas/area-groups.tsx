"use client";

import { ChevronDown, Info } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { PURPOSE_HEX, PURPOSE_META } from "@/components/domain/purpose-chip";
import { EASE } from "@/components/ui/motion";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { useL, useLang, useT } from "@/lib/i18n";
import { cn, formatHectares, formatNumber } from "@/lib/utils";

import type { AreaListItem } from "./api";
import { AreaRow } from "./area-row";
import { CROP_META, CROPS_BY_PURPOSE, type CropKey, cropOf } from "./crops";

type CropGroup = { key: string; crop: CropKey; areas: AreaListItem[]; ha: number; open: number };
type PurposeGroup = { purpose: Purpose; areas: AreaListItem[]; ha: number; open: number; crops: CropGroup[] };

const isOpen = (a: AreaListItem) => !!a.competition?.is_open && a.demining_status === "CLEARED";

/** Purpose → recommended crop → plot, with totals at every level. Order follows the incoming (sorted) list. */
export function groupAreas(items: AreaListItem[]): PurposeGroup[] {
  return PURPOSES.map((purpose) => {
    const areas = items.filter((a) => a.purpose === purpose);
    const crops = CROPS_BY_PURPOSE[purpose]
      .map((crop) => {
        const list = areas.filter((a) => cropOf(a) === crop);
        return {
          key: `${purpose}:${crop}`,
          crop,
          areas: list,
          ha: list.reduce((s, a) => s + Number(a.area_ha), 0),
          open: list.filter(isOpen).length
        };
      })
      .filter((c) => c.areas.length > 0);
    return {
      purpose,
      areas,
      ha: areas.reduce((s, a) => s + Number(a.area_ha), 0),
      open: areas.filter(isOpen).length,
      crops
    };
  }).filter((g) => g.areas.length > 0);
}

const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { height: { duration: 0.4, ease: EASE }, opacity: { duration: 0.25, delay: 0.05 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.3, ease: EASE }, opacity: { duration: 0.15 } } }
};

const toggleIn = (set: Set<string>, key: string) => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

/**
 * The map's side list: one collapsible section per purpose (Əkinçilik, Bağçılıq…),
 * inside it one sub-section per recommended crop (taxıl, arpa, yonca…), inside
 * that the plots. Selecting a plot on the map opens its sections and scrolls to it.
 */
export function AreaGroups({
  items,
  geometries,
  selected,
  highlighted,
  onSelect,
  onHover
}: {
  items: AreaListItem[];
  geometries: Map<string, GeoJSON.Geometry>;
  selected: string | null;
  highlighted: string | null;
  onSelect: (code: string) => void;
  onHover: (code: string | null) => void;
}) {
  const t = useT();
  const L = useL();
  const { lang } = useLang();
  const groups = useMemo(() => groupAreas(items), [items]);
  const [openPurposes, setOpenPurposes] = useState<Set<string>>(new Set());
  const [openCrops, setOpenCrops] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  // Until the visitor folds things themselves, the first section starts open.
  useEffect(() => {
    if (!touched && groups.length) setOpenPurposes(new Set([groups[0].purpose]));
  }, [groups, touched]);

  // Reveal the selected plot: open its purpose and crop, then scroll to it.
  useEffect(() => {
    if (!selected) return;
    const area = items.find((a) => a.code === selected);
    if (!area) return;
    const cropKey = `${area.purpose}:${cropOf(area)}`;
    setOpenPurposes((s) => (s.has(area.purpose) ? s : new Set(s).add(area.purpose)));
    setOpenCrops((s) => (s.has(cropKey) ? s : new Set(s).add(cropKey)));
    const timer = setTimeout(
      () => document.getElementById(`area-row-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      450
    );
    return () => clearTimeout(timer);
  }, [selected, items]);

  return (
    <div className="space-y-2.5">
      {groups.map((g, gi) => {
        const open = openPurposes.has(g.purpose);
        const Icon = PURPOSE_META[g.purpose].icon;
        const color = PURPOSE_HEX[g.purpose];
        return (
          <motion.section
            key={g.purpose}
            layout="position"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: gi * 0.06 }}
            className={cn(
              "overflow-hidden rounded-3xl border transition-colors duration-300",
              open ? "border-white/70 bg-white/80 shadow-card" : "border-white/50 bg-white/50 hover:bg-white/75"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setTouched(true);
                setOpenPurposes((s) => toggleIn(s, g.purpose));
              }}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
            >
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}22`, color }}>
                <Icon className="size-5" aria-hidden />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-white" style={{ background: color }} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-15 font-semibold text-ink">{t.purpose[g.purpose]}</span>
                <span className="block text-13 text-ink-3">
                  <span className="tabular">{g.areas.length}</span> {L("sahə", "plots")} · <span className="tabular">{formatHectares(g.ha)}</span> ·{" "}
                  <span className="tabular">{g.crops.length}</span> {L("növ", "types")}
                </span>
              </span>
              {g.open > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-2xs font-bold text-ink tabular" title={L("Açıq müsabiqədə olan sahələr", "Plots in an open competition")}>
                  {g.open} {L("açıq", "open")}
                </span>
              )}
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }} className="text-ink-3">
                <ChevronDown className="size-5" aria-hidden />
              </motion.span>
            </button>

            {/* Share of plots in this section that are open for applications. */}
            <div className="mx-3.5 mb-3 h-1 overflow-hidden rounded-full bg-ink/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${(g.open / Math.max(1, g.areas.length)) * 100}%` }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.2 + gi * 0.06 }}
              />
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div key="body" {...collapse} className="overflow-hidden">
                  <div className="space-y-1.5 px-2 pb-2.5">
                    {g.crops.map((c, ci) => {
                      const cOpen = openCrops.has(c.key);
                      const meta = CROP_META[c.crop];
                      const CropIcon = meta.icon;
                      return (
                        <motion.div
                          key={c.key}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35, ease: EASE, delay: 0.05 + ci * 0.05 }}
                          className={cn("rounded-2xl transition-colors", cOpen ? "bg-white/90 shadow-card" : "bg-ink/[0.03] hover:bg-white/70")}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenCrops((s) => toggleIn(s, c.key))}
                            aria-expanded={cOpen}
                            className="flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-13"
                          >
                            <motion.span
                              animate={{ scale: cOpen ? 1.08 : 1 }}
                              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                              style={{ background: `${meta.color}26`, color: meta.color }}
                            >
                              <CropIcon className="size-[18px]" aria-hidden />
                            </motion.span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-ink">{lang === "en" ? meta.en : meta.az}</span>
                              <span className="block truncate text-2xs text-ink-3">
                                <span className="tabular">{c.areas.length}</span> {L("sahə", "plots")} · <span className="tabular">{formatNumber(c.ha, 1)}</span> ha
                                {c.open > 0 && (
                                  <>
                                    {" "}· <span className="font-semibold text-accent-text">{c.open} {L("açıq", "open")}</span>
                                  </>
                                )}
                              </span>
                            </span>
                            <motion.span animate={{ rotate: cOpen ? 0 : -90 }} transition={{ duration: 0.25 }} className="text-ink-3">
                              <ChevronDown className="size-4" aria-hidden />
                            </motion.span>
                          </button>
                          <AnimatePresence initial={false}>
                            {cOpen && (
                              <motion.div key="rows" {...collapse} className="overflow-hidden">
                                <p className="mx-3 mb-1.5 flex items-start gap-1.5 rounded-xl bg-primary-50/80 px-2.5 py-1.5 text-2xs text-primary">
                                  <Info className="mt-px size-3 shrink-0" aria-hidden />
                                  {lang === "en" ? meta.whyEn : meta.whyAz}
                                </p>
                                <ul className="relative ml-[22px] space-y-1 border-l border-dashed border-border-strong pb-1.5 pl-2 pr-1">
                                  {c.areas.map((a, ai) => (
                                    <motion.li
                                      key={a.code}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3, ease: EASE, delay: Math.min(ai, 8) * 0.035 }}
                                    >
                                      <AreaRow
                                        area={a}
                                        geometry={geometries.get(a.code)}
                                        selected={selected === a.code}
                                        highlighted={highlighted === a.code}
                                        onSelect={onSelect}
                                        onHover={onHover}
                                      />
                                    </motion.li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        );
      })}
    </div>
  );
}
