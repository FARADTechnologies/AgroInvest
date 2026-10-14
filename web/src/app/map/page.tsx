"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";

import { Skeleton } from "@/components/ui/panel";
import { useAreaFeatures, useAreas, useMapContext } from "@/features/areas/api";
import { AreaRow } from "@/features/areas/area-row";
import { CompareTray } from "@/features/areas/compare-controls";
import { FilterPanel } from "@/features/areas/filter-panel";
import { useAreaFilters } from "@/features/areas/filters";
import { SelectedAreaCard } from "@/features/areas/selected-area-card";
import { type BasemapKind, useOnlineBasemaps } from "@/components/map/basemap";
import type { MapMode } from "@/components/map/farm-map";
import { MapLegend } from "@/components/map/map-legend";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-border bg-surface p-0.5 text-13 shadow-popover">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={cn(
            "rounded px-2.5 py-1 font-medium",
            value === key ? "bg-primary text-primary-fg" : "text-ink-2 hover:bg-surface-2"
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// MapLibre needs the browser; it is never rendered on the server.
const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#F1EEE8]" />
});

function MapView() {
  const { filters, update, reset, active } = useAreaFilters();
  const { data: page, isFetching } = useAreas(filters, 1, 200);
  const { data: features } = useAreaFeatures(filters);
  const { data: context } = useMapContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mode, setMode] = useState<MapMode>("purpose");
  const [basemap, setBasemap] = useState<BasemapKind>("map");
  const online = useOnlineBasemaps();
  const hasSuitability = !!features?.features.some((f) => f.properties.fao_class);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col md:flex-row">
      <aside className="flex max-h-[55vh] flex-col border-b border-border bg-surface md:max-h-none md:w-[380px] md:shrink-0 md:border-b-0 md:border-r">
        <div className="border-b border-border p-4">
          <h1 className="sr-only">Aqrar investisiya xəritəsi</h1>
          <FilterPanel
            filters={filters}
            update={update}
            reset={reset}
            active={active}
            counts={page?.purpose_counts}
          />
        </div>
        <div className="flex items-center justify-between border-b border-border px-4 py-2 text-13 text-ink-2">
          <span aria-live="polite">
            <span className="tabular font-medium text-ink">{page?.total ?? "…"}</span> sahə
          </span>
          {isFetching && <span className="text-ink-3">Yenilənir…</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!page
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="m-4 h-14" />)
            : page.items.map((area) => (
                <AreaRow
                  key={area.code}
                  area={area}
                  selected={selected === area.code}
                  onSelect={() => setSelected(area.code)}
                  onHover={(on) => setHovered(on ? area.code : null)}
                />
              ))}
          {page && page.items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink-2">
              Bu filtrlərə uyğun sahə tapılmadı.
              {active && (
                <button type="button" onClick={reset} className="ml-1 font-medium text-primary hover:underline">
                  Filtrləri sıfırla
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      <section className="relative min-h-[50vh] flex-1" aria-label="Xəritə">
        <FarmMap
          features={features}
          context={context}
          selectedCode={selected}
          highlightCode={hovered}
          mode={mode}
          basemap={basemap}
          onSelect={setSelected}
          className="h-full w-full"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {/* Imagery needs the internet; offline the switch is hidden and the drawn map stays. */}
          {online && (
            <Segmented
              label="Altlıq xəritə"
              options={[
                ["map", "Xəritə"],
                ["satellite", "Peyk"]
              ]}
              value={basemap}
              onChange={setBasemap}
            />
          )}
          {hasSuitability && (
            <Segmented
              label="Rəngləmə"
              options={[
                ["purpose", "Təyinat"],
                ["suitability", "Uyğunluq"]
              ]}
              value={mode}
              onChange={setMode}
            />
          )}
        </div>
        {selected && (
          <SelectedAreaCard
            code={selected}
            onClose={() => setSelected(null)}
            className={cn("absolute right-14 top-3 z-20 max-md:left-3 max-md:right-3 max-md:w-auto")}
          />
        )}
        <MapLegend mode={mode} className="absolute bottom-8 left-3" />
        {/* Starts right of the legend so the two never overlap. */}
        <CompareTray className="absolute bottom-8 left-[184px] right-14 z-20 max-w-[560px]" />
      </section>
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
