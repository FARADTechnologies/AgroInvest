"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Droplets, MapPin, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PURPOSE_HEX, PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/panel";
import { type AreaListItem, useAreaFeatures, useAreas } from "@/features/areas/api";
import { AreaShape } from "@/features/areas/area-shape";
import { CompareButton } from "@/features/areas/compare-controls";
import { FilterPanel } from "@/features/areas/filter-panel";
import { useAreaFilters } from "@/features/areas/filters";
import { PurposeTabs } from "@/features/areas/purpose-tabs";
import { useIrrigationLabel } from "@/features/areas/selected-area-card";
import { useL } from "@/lib/i18n";
import { cn, formatDate, formatHectares } from "@/lib/utils";

const PAGE_SIZE = 12;

function CatalogueCard({ area, geometry, index }: { area: AreaListItem; geometry?: GeoJSON.Geometry; index: number }) {
  const L = useL();
  const irrigation = useIrrigationLabel();
  const comp = area.competition;
  const cleared = area.demining_status === "CLEARED";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-card transition-shadow duration-300 hover:shadow-float"
    >
      <Link href={`/areas/${area.code}`} className="relative block h-40 overflow-hidden bg-[#2E4A33] p-6">
        <span
          className="absolute inset-0 opacity-40 transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, #4E6B3F 0 6px, #3A5530 6px 14px)" }}
          aria-hidden
        />
        <AreaShape geometry={geometry} color={PURPOSE_HEX[area.purpose]} className="relative transition-transform duration-700 ease-spring group-hover:scale-110 group-hover:rotate-2" strokeWidth={2.4} />
        <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-1 font-mono text-2xs font-semibold text-white backdrop-blur">
          {area.code}
        </span>
        {area.best_fao_class && (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 font-mono text-2xs font-bold text-ink">{area.best_fao_class}</span>
        )}
        {!cleared && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2.5 py-1 text-2xs font-semibold text-status-info-fg">
            <ShieldAlert className="size-3" aria-hidden /> {L("Minatəmizləmə davam edir", "Demining in progress")}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-15 leading-snug">
            <Link href={`/areas/${area.code}`} className="hover:underline">
              {area.name_az}
            </Link>
          </h2>
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-13 font-semibold text-primary-fg tabular">
            {formatHectares(Number(area.area_ha))}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-13 text-ink-2">
          <PurposeChip purpose={area.purpose} />
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-ink-3" aria-hidden />
            {area.village_name ? `${area.village_name}, ` : ""}
            {area.rayon_name}
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="size-3.5 text-ink-3" aria-hidden />
            {irrigation(area.irrigation)}
          </span>
        </div>
        <div className="mt-auto pt-4">
          {comp ? (
            <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-13">
              <Link href={`/competitions/${comp.number}`} className="font-mono font-semibold text-primary hover:underline">
                {comp.number}
              </Link>
              <span className="text-ink-3">{formatDate(comp.deadline_at)}</span>
              <DeadlineBadge iso={comp.deadline_at} />
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-2 px-3 py-2 text-13 text-ink-3">{L("Müsabiqəyə çıxarılmayıb", "Not offered yet")}</div>
          )}
          <div className="mt-3 flex gap-2">
            <CompareButton code={area.code} className="flex-1" />
            {comp?.is_open ? (
              <Button asChild variant="lime" size="sm" className="flex-1">
                <Link href={`/cabinet/applications/new?area=${area.code}`}>
                  {L("Müraciət et", "Apply")} <ArrowUpRight />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/areas/${area.code}`}>{L("Ətraflı", "Details")}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function CatalogueView() {
  const L = useL();
  const { filters, update, reset, active } = useAreaFilters();
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useAreas(filters, page, PAGE_SIZE);
  const { data: features } = useAreaFeatures(filters);
  useEffect(() => setPage(1), [filters]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const geometries = useMemo(
    () => new Map((features?.features ?? []).map((f) => [f.properties.code, f.geometry as GeoJSON.Geometry])),
    [features]
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow={L("Kataloq", "Catalogue")}
        title={L("İnvestisiya imkanları", "Investment opportunities")}
        description={L("Müsabiqəyə çıxarılan təsərrüfat sahələri: ölçü, yerləşdiyi ərazi, istifadə şərtləri və son müraciət tarixi.", "Farm plots offered in competitions: size, location, terms of use and application deadline.")}
        actions={
          <span className="rounded-full border border-border bg-surface px-4 py-2 text-13 text-ink-2 shadow-card">
            <span className="tabular font-semibold text-ink">{data?.total ?? "…"}</span> {L("sahə", "plots")}
            {isFetching && <span className="ml-2 text-ink-3">· {L("yenilənir", "updating")}</span>}
          </span>
        }
      />

      <PurposeTabs value={filters.purposes} onChange={(purposes) => update({ purposes })} counts={data?.purpose_counts} className="mx-0 mt-6 w-fit max-w-full" />

      <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-border/70 bg-surface p-4 shadow-card">
            <FilterPanel filters={filters} update={update} reset={reset} active={active} counts={data?.purpose_counts} showPurposes={false} />
          </div>
        </aside>
        <section>
          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[380px] rounded-3xl" />)}
            <AnimatePresence mode="popLayout">
              {data?.items.map((area, i) => (
                <CatalogueCard key={area.code} area={area} geometry={geometries.get(area.code)} index={i} />
              ))}
            </AnimatePresence>
          </ul>
          {data && data.items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border-strong px-5 py-16 text-center text-sm text-ink-2">
              {L("Bu filtrlərə uyğun sahə tapılmadı.", "No plots match these filters.")}
              {active && (
                <button type="button" onClick={reset} className="ml-1 font-semibold text-primary hover:underline">
                  {L("Filtrləri sıfırla", "Reset filters")}
                </button>
              )}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-2 text-13 text-ink-2" aria-label={L("Səhifələr", "Pages")}>
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> {L("Əvvəlki", "Previous")}
              </Button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={cn(
                    "size-8 rounded-full font-semibold tabular transition-colors",
                    n === page ? "bg-primary text-primary-fg" : "hover:bg-surface"
                  )}
                >
                  {n}
                </button>
              ))}
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                {L("Növbəti", "Next")} <ChevronRight />
              </Button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense>
      <CatalogueView />
    </Suspense>
  );
}
