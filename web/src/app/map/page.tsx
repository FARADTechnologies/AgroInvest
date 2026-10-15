"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Globe2, List, Map as MapIcon, PanelLeftClose, RotateCcw, SlidersHorizontal, Sprout } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Basemap } from "@/components/map/basemap";
import type { MapMode } from "@/components/map/farm-map";
import { MapLegend } from "@/components/map/map-legend";
import { AnimatedNumber, EASE } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/panel";
import { areaQuery, type AreaFeatureCollection, useAreaFeatures, useAreas, useMapContext } from "@/features/areas/api";
import { AreaGroups } from "@/features/areas/area-groups";
import { CompareTray } from "@/features/areas/compare-controls";
import { CROPS_BY_PURPOSE, type CropKey, cropOf } from "@/features/areas/crops";
import { FilterPanel, SearchBox } from "@/features/areas/filter-panel";
import { useAreaFilters } from "@/features/areas/filters";
import { CropTabs, PurposeTabs } from "@/features/areas/purpose-tabs";
import { SelectedAreaCard } from "@/features/areas/selected-area-card";
import type { Purpose } from "@/lib/domain";
import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// MapLibre needs the browser; it is never rendered on the server.
const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1B2A1F]" />
});

const PANEL_W = 400;

function Segmented<T extends string>({
  value,
  onChange,
  options,
  id
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: typeof MapIcon }[];
  id: string;
}) {
  return (
    <div className="flex rounded-full bg-white/60 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-13 font-medium transition-colors", active ? "text-primary-fg" : "text-ink-2 hover:text-ink")}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 480, damping: 38 }} />
            )}
            {Icon && <Icon className={cn("relative size-3.5", active && "text-accent")} aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "lime" }) {
  return (
    <div className={cn("rounded-2xl px-3 py-2", tone === "lime" ? "bg-accent" : "bg-white/60")}>
      <div className={cn("truncate text-2xs font-medium", tone === "lime" ? "text-ink/70" : "text-ink-3")}>{label}</div>
      <div className="text-lg font-semibold leading-tight text-ink">{children}</div>
    </div>
  );
}

function MapView() {
  const L = useL();
  const { filters, update, reset, active } = useAreaFilters();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  const { data: page, isFetching } = useAreas(filters, 1, 200);
  const { data: allFeatures } = useAreaFeatures(filters);
  const { data: context } = useMapContext();
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("purpose");
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [showFilters, setShowFilters] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  // Selection and crop type live in the URL (?area=…&crop=…), so a view can be shared.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const replaceParams = useCallback(
    (edit: (sp: URLSearchParams) => void) => {
      const sp = new URLSearchParams(paramsRef.current.toString());
      edit(sp);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );
  const selected = params.get("area");
  const setSelected = useCallback(
    (code: string | null) => replaceParams((sp) => (code ? sp.set("area", code) : sp.delete("area"))),
    [replaceParams]
  );
  const setPurposes = (purposes: Purpose[]) =>
    replaceParams((sp) => {
      if (purposes.length) sp.set("purpose", purposes.join(","));
      else sp.delete("purpose");
      sp.delete("crop");
    });

  // A crop only applies inside its own purpose.
  const purpose = filters.purposes.length === 1 ? filters.purposes[0] : null;
  const cropParam = params.get("crop") as CropKey | null;
  const crop = purpose && cropParam && CROPS_BY_PURPOSE[purpose].includes(cropParam) ? cropParam : null;
  const setCrop = (next: CropKey | null) => replaceParams((sp) => (next ? sp.set("crop", next) : sp.delete("crop")));

  // Hovering a row or a plot warms the detail cache, so the card opens instantly.
  const onHover = useCallback(
    (code: string | null) => {
      setHovered(code);
      if (code) void qc.prefetchQuery(areaQuery(code));
    },
    [qc]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSelected]);

  const allItems = useMemo(() => page?.items ?? [], [page]);
  const items = useMemo(() => (crop ? allItems.filter((a) => cropOf(a) === crop) : allItems), [allItems, crop]);
  const cropCounts = useMemo(() => {
    const counts: Partial<Record<CropKey, number>> = {};
    for (const a of allItems) {
      const c = cropOf(a);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);
  const features = useMemo<AreaFeatureCollection | undefined>(() => {
    if (!allFeatures || !crop) return allFeatures;
    const codes = new Set(items.map((a) => a.code));
    return { ...allFeatures, features: allFeatures.features.filter((f) => codes.has(f.properties.code)) };
  }, [allFeatures, items, crop]);

  const geometries = useMemo(
    () => new Map((allFeatures?.features ?? []).map((f) => [f.properties.code, f.geometry as GeoJSON.Geometry])),
    [allFeatures]
  );
  const hasSuitability = !!allFeatures?.features.some((f) => f.properties.fao_class);
  const totals = useMemo(
    () => ({
      ha: items.reduce((s, a) => s + Number(a.area_ha), 0),
      open: items.filter((a) => a.competition?.is_open && a.demining_status === "CLEARED").length
    }),
    [items]
  );

  const filterCount =
    (filters.region ? 1 : 0) + (filters.rayonId !== null ? 1 : 0) + (filters.minHa !== null || filters.maxHa !== null ? 1 : 0) + (filters.openOnly ? 1 : 0);

  // Overlays on the left move aside when the panel is open.
  const overlayLeft = panelOpen ? "md:left-[432px]" : "md:left-4";

  return (
    <div className="relative h-[calc(100dvh-64px)] min-h-[560px] overflow-hidden bg-[#1B2A1F]">
      <div className="absolute inset-0">
      <FarmMap
        features={features}
        context={context}
        selectedCode={selected}
        highlightCode={hovered}
        mode={mode}
        basemap={basemap}
        onSelect={setSelected}
        onHover={onHover}
        sidePadding={440}
        leftPadding={panelOpen ? PANEL_W + 76 : 60}
        className="h-full w-full"
      />
      </div>

      {/* Plots panel, floating over the map as frosted glass. */}
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.aside
            key="panel"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute inset-x-3 bottom-3 z-20 flex max-h-[58%] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/55 shadow-float backdrop-blur-2xl md:inset-x-auto md:bottom-4 md:left-4 md:top-4 md:max-h-none md:w-[400px]"
          >
            <div className="space-y-3 border-b border-white/50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-accent">
                  <Sprout className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg leading-tight">{L("Təsərrüfat sahələri", "Farm plots")}</h1>
                  <p className="text-13 text-ink-2">{isFetching ? L("Yenilənir…", "Updating…") : L("Qarabağ və Şərqi Zəngəzur", "Karabakh and East Zangezur")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full border transition-colors",
                    showFilters ? "border-primary bg-primary text-primary-fg" : "border-white/70 bg-white/70 text-ink-2 hover:text-ink"
                  )}
                  title={L("Filtrlər", "Filters")}
                  aria-label={L("Filtrlər", "Filters")}
                >
                  <SlidersHorizontal className="size-4" />
                  {filterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-2xs font-bold text-ink ring-2 ring-white">
                      {filterCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/70 text-ink-2 transition-colors hover:text-ink"
                  title={L("Paneli gizlət", "Hide panel")}
                  aria-label={L("Paneli gizlət", "Hide panel")}
                >
                  <PanelLeftClose className="size-4" />
                </button>
              </div>

              <SearchBox value={filters.q} onChange={(q) => update({ q })} />
              <PurposeTabs value={filters.purposes} onChange={setPurposes} counts={page?.purpose_counts} />
              <CropTabs purpose={purpose} value={crop} onChange={setCrop} counts={cropCounts} />

              <AnimatePresence initial={false}>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <FilterPanel
                      filters={filters}
                      update={update}
                      reset={reset}
                      active={active}
                      showSearch={false}
                      showPurposes={false}
                      className="rounded-2xl bg-white/60 p-3"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-3 gap-2" aria-live="polite">
                <MiniStat label={L("Sahə", "Plots")}>
                  <AnimatedNumber value={items.length} />
                </MiniStat>
                <MiniStat label={L("Hektar", "Hectares")}>
                  <AnimatedNumber value={totals.ha} />
                </MiniStat>
                <MiniStat label={L("Açıq müsabiqədə", "Open now")} tone="lime">
                  <AnimatedNumber value={totals.open} />
                </MiniStat>
              </div>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
              {!page ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-3xl opacity-70" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-14 text-center">
                  <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-white/70 text-ink-3">
                    <Sprout className="size-6" aria-hidden />
                  </span>
                  <p className="mt-3 text-sm text-ink-2">{L("Bu filtrlərə uyğun sahə tapılmadı.", "No plots match these filters.")}</p>
                  {(active || crop) && (
                    <button
                      type="button"
                      onClick={reset}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-13 font-medium text-primary-fg"
                    >
                      <RotateCcw className="size-3.5" aria-hidden /> {L("Filtrləri sıfırla", "Reset filters")}
                    </button>
                  )}
                </motion.div>
              ) : (
                <AreaGroups items={items} geometries={geometries} selected={selected} highlighted={hovered} onSelect={setSelected} onHover={onHover} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Reopen the panel. */}
      <AnimatePresence>
        {!panelOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            onClick={() => setPanelOpen(true)}
            className="glass absolute bottom-4 left-3 z-20 flex items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-semibold text-ink md:bottom-auto md:left-4 md:top-4"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-accent">
              <List className="size-4" aria-hidden />
            </span>
            {L("Sahələr", "Plots")}
            <span className="rounded-full bg-accent px-2 text-2xs font-bold tabular">{items.length}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "glass absolute left-3 top-3 z-10 flex flex-wrap items-center gap-1.5 rounded-full p-1 transition-[left] duration-500 ease-spring md:top-4",
          overlayLeft,
          !panelOpen && "md:left-[170px]"
        )}
      >
        <Segmented
          id="basemap"
          value={basemap}
          onChange={setBasemap}
          options={[
            { value: "satellite", label: L("Peyk", "Satellite"), icon: Globe2 },
            { value: "map", label: L("Xəritə", "Map"), icon: MapIcon }
          ]}
        />
        {hasSuitability && (
          <Segmented
            id="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "purpose", label: L("Təyinat", "Purpose") },
              { value: "suitability", label: L("Uyğunluq", "Suitability") }
            ]}
          />
        )}
      </div>

      <MapLegend mode={mode} className={cn("absolute top-[72px] z-10 hidden transition-[left] duration-500 ease-spring lg:block", overlayLeft)} />

      <AnimatePresence mode="wait">
        {selected && (
          <SelectedAreaCard
            key={selected}
            code={selected}
            geometry={geometries.get(selected)}
            onClose={() => setSelected(null)}
            className="absolute right-3 top-3 z-30 h-fit max-h-[calc(100%-24px)] max-md:left-3 max-md:w-auto md:right-16 md:top-4"
          />
        )}
      </AnimatePresence>

      {/* Wrapper carries the centring transform; the tray animates its own. */}
      <div className="absolute bottom-8 left-1/2 z-20 w-[min(92%,560px)] -translate-x-1/2 max-md:hidden lg:left-[calc(50%+200px)]">
        <CompareTray />
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
