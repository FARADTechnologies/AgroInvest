"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Droplets, MapPin, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PURPOSE_HEX, PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/panel";
import { type AreaListItem, useAreaFeatures, useAreas } from "@/features/areas/api";
import { CompareButton } from "@/features/areas/compare-controls";
import { CROP_META, CROPS_BY_PURPOSE, type CropKey, cropOf } from "@/features/areas/crops";
import { FilterPanel } from "@/features/areas/filter-panel";
import { useAreaFilters } from "@/features/areas/filters";
import { PlotImage } from "@/features/areas/plot-image";
import { CropTabs, PurposeTabs } from "@/features/areas/purpose-tabs";
import { useIrrigationLabel } from "@/features/areas/selected-area-card";
import type { Purpose } from "@/lib/domain";
import { useL, useLang } from "@/lib/i18n";
import { cn, formatDate, formatHectares } from "@/lib/utils";

const PAGE_SIZE = 12;

function CatalogueCard({ area, geometry, index }: { area: AreaListItem; geometry?: GeoJSON.Geometry; index: number }) {
  const L = useL();
  const { lang } = useLang();
  const irrigation = useIrrigationLabel();
  const comp = area.competition;
  const cleared = area.demining_status === "CLEARED";
  const crop = CROP_META[cropOf(area)];
  const CropIcon = crop.icon;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
      className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-card transition-shadow duration-300 hover:shadow-float"
    >
      <Link href={`/areas/${area.code}`} className="block overflow-hidden" aria-label={area.name_az}>
        <PlotImage
          geometry={geometry}
          color={PURPOSE_HEX[area.purpose]}
          width={400}
          height={200}
          pad={0.5}
          strokeWidth={2.5}
          className="w-full transition-transform duration-700 ease-spring group-hover:scale-[1.04]"
        >
          <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-2xs font-semibold text-white backdrop-blur">
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
        </PlotImage>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 text-15 leading-snug">
            <Link href={`/areas/${area.code}`} className="hover:underline">
              {area.name_az}
            </Link>
          </h2>
          <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-13 font-semibold text-primary-fg tabular">
            {formatHectares(Number(area.area_ha))}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PurposeChip purpose={area.purpose} />
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-13 font-medium"
            style={{ background: `${crop.color}1f`, color: crop.color }}
            title={lang === "en" ? crop.whyEn : crop.whyAz}
          >
            <CropIcon className="size-3.5" aria-hidden />
            {lang === "en" ? crop.en : crop.az}
          </span>
        </div>
        <div className="mt-2 space-y-1 text-13 text-ink-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-ink-3" aria-hidden />
            <span className="truncate">
              {area.village_name ? `${area.village_name}, ` : ""}
              {area.rayon_name}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="size-3.5 shrink-0 text-ink-3" aria-hidden />
            {irrigation(area.irrigation)}
          </div>
        </div>
        <div className="mt-auto pt-4">
          {comp ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-13">
              <span className="min-w-0">
                <Link href={`/competitions/${comp.number}`} className="block whitespace-nowrap font-mono font-semibold text-primary hover:underline">
                  {comp.number}
                </Link>
                <span className="block text-2xs text-ink-3">{formatDate(comp.deadline_at)}</span>
              </span>
              <DeadlineBadge iso={comp.deadline_at} className="shrink-0" />
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-2 px-3 py-2 text-13 text-ink-3">{L("Müsabiqəyə çıxarılmayıb", "Not offered yet")}</div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CompareButton code={area.code} short className="min-w-0" />
            {comp?.is_open ? (
              <Button asChild variant="lime" size="sm" className="min-w-0">
                <Link href={`/cabinet/applications/new?area=${area.code}`}>
                  {L("Müraciət et", "Apply")} <ArrowUpRight />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="secondary" size="sm" className="min-w-0">
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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [page, setPage] = useState(1);

  // A crop type applies inside its own purpose; it is filtered here in the
  // browser, so with one selected the catalogue loads every match at once.
  const purpose = filters.purposes.length === 1 ? filters.purposes[0] : null;
  const cropParam = params.get("crop") as CropKey | null;
  const crop = purpose && cropParam && CROPS_BY_PURPOSE[purpose].includes(cropParam) ? cropParam : null;

  const { data, isLoading, isFetching } = useAreas(filters, crop ? 1 : page, crop ? 200 : PAGE_SIZE);
  // Purpose totals and crop counts come from the whole filtered set.
  const { data: all } = useAreas(filters, 1, 200);
  const { data: features } = useAreaFeatures(filters);
  useEffect(() => setPage(1), [filters, crop]);

  const cropCounts = useMemo(() => {
    const counts: Partial<Record<CropKey, number>> = {};
    for (const a of all?.items ?? []) counts[cropOf(a)] = (counts[cropOf(a)] ?? 0) + 1;
    return counts;
  }, [all]);
  const cropItems = useMemo(() => (crop ? (data?.items ?? []).filter((a) => cropOf(a) === crop) : null), [data, crop]);
  const items = cropItems ? cropItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : data?.items;
  const total = cropItems ? cropItems.length : data?.total;
  const pages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const geometries = useMemo(
    () => new Map((features?.features ?? []).map((f) => [f.properties.code, f.geometry as GeoJSON.Geometry])),
    [features]
  );

  const setUrl = (edit: (sp: URLSearchParams) => void) => {
    const sp = new URLSearchParams(params.toString());
    edit(sp);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setPurposes = (next: Purpose[]) =>
    setUrl((sp) => {
      if (next.length) sp.set("purpose", next.join(","));
      else sp.delete("purpose");
      sp.delete("crop");
    });
  const setCrop = (next: CropKey | null) => setUrl((sp) => (next ? sp.set("crop", next) : sp.delete("crop")));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow={L("Kataloq", "Catalogue")}
        title={L("İnvestisiya imkanları", "Investment opportunities")}
        description={L(
          "Müsabiqəyə çıxarılan təsərrüfat sahələri: ölçü, yerləşdiyi ərazi, istifadə şərtləri və son müraciət tarixi.",
          "Farm plots offered in competitions: size, location, terms of use and application deadline."
        )}
        actions={
          <span className="rounded-full border border-border bg-surface px-4 py-2 text-13 text-ink-2 shadow-card">
            <span className="tabular font-semibold text-ink">{total ?? "…"}</span> {L("sahə", "plots")}
            {isFetching && <span className="ml-2 text-ink-3">· {L("yenilənir", "updating")}</span>}
          </span>
        }
      />

      {/* Purpose, then its crop types underneath. */}
      <div className="mt-6 space-y-3 rounded-3xl border border-border/70 bg-surface p-3 shadow-card">
        <PurposeTabs value={filters.purposes} onChange={setPurposes} counts={all?.purpose_counts} wrap className="mx-0" />
        <CropTabs purpose={purpose} value={crop} onChange={setCrop} counts={cropCounts} />
        {!purpose && (
          <p className="px-1 text-13 text-ink-3">
            {L("Təyinatı seçin — onun bitki növləri (məs. taxıl, arpa, yonca) burada açılacaq.", "Pick a purpose to see its crop types (e.g. wheat, barley, alfalfa).")}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-border/70 bg-surface p-4 shadow-card">
            <FilterPanel filters={filters} update={update} reset={reset} active={active} counts={data?.purpose_counts} showPurposes={false} />
          </div>
        </aside>
        <section className="min-w-0">
          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[420px] rounded-3xl" />)}
            <AnimatePresence mode="popLayout">
              {items?.map((area, i) => (
                <CatalogueCard key={area.code} area={area} geometry={geometries.get(area.code)} index={i} />
              ))}
            </AnimatePresence>
          </ul>
          {items && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border-strong px-5 py-16 text-center text-sm text-ink-2">
              {L("Bu filtrlərə uyğun sahə tapılmadı.", "No plots match these filters.")}
              {(active || crop) && (
                <button type="button" onClick={reset} className="ml-1 font-semibold text-primary hover:underline">
                  {L("Filtrləri sıfırla", "Reset filters")}
                </button>
              )}
            </div>
          )}
          {pages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2 text-13 text-ink-2" aria-label={L("Səhifələr", "Pages")}>
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> {L("Əvvəlki", "Previous")}
              </Button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={cn("size-8 rounded-full font-semibold tabular transition-colors", n === page ? "bg-primary text-primary-fg" : "hover:bg-surface")}
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
