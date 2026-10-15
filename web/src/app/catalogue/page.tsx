"use client";

import { ChevronLeft, ChevronRight, Droplets, MapPin, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { type AreaListItem, useAreas } from "@/features/areas/api";
import { FilterPanel } from "@/features/areas/filter-panel";
import { type AreaFilters, useAreaFilters } from "@/features/areas/filters";
import { useProfile } from "@/features/applications/api";
import { useCanApply, useSession } from "@/features/auth/use-session";
import { IRRIGATION_LABEL } from "@/features/areas/selected-area-card";
import { formatAzn, formatDate, formatHectares } from "@/lib/utils";

const PAGE_SIZE = 15;

function CatalogueRow({ area }: { area: AreaListItem }) {
  const canApply = useCanApply();
  const comp = area.competition;
  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/areas/${area.code}`} className="font-mono text-13 font-medium text-primary hover:underline">
            {area.code}
          </Link>
          <PurposeChip purpose={area.purpose} />
          {area.demining_status !== "CLEARED" && (
            <span className="rounded-sm bg-status-info-bg px-2 py-0.5 text-13 text-status-info-fg">Minatəmizləmə davam edir · nümayiş</span>
          )}
        </div>
        <h2 className="mt-1.5 text-15">
          <Link href={`/areas/${area.code}`} className="hover:underline">
            {area.name_az}
          </Link>
        </h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-13 text-ink-2">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-ink-3" aria-hidden />
            {area.village_name ? `${area.village_name}, ` : ""}
            {area.rayon_name}
          </span>
          <span className="tabular font-medium text-ink">{formatHectares(Number(area.area_ha))}</span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="size-3.5 text-ink-3" aria-hidden />
            {IRRIGATION_LABEL[area.irrigation]}
          </span>
          {area.annual_fee_azn_per_ha && (
            <span>İcarə: {formatAzn(Number(area.annual_fee_azn_per_ha))}/ha illik</span>
          )}
          {area.best_fao_class && <span>Uyğunluq: {area.best_fao_class}</span>}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2 md:items-end md:text-right">
        {comp ? (
          <div className="text-13">
            <Link href={`/competitions/${comp.number}`} className="font-mono text-ink-2 hover:text-primary">
              {comp.number}
            </Link>
            <div className="text-ink-2">Son müraciət: {formatDate(comp.deadline_at)}</div>
            {area.min_investment_azn && (
              <div className="text-ink-2">
                Min. investisiya: <span className="tabular text-ink">{formatAzn(Number(area.min_investment_azn))}</span>
              </div>
            )}
            <DeadlineBadge iso={comp.deadline_at} />
          </div>
        ) : (
          <span className="text-13 text-ink-3">Müsabiqəyə çıxarılmayıb</span>
        )}
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/areas/${area.code}`}>Ətraflı</Link>
          </Button>
          {comp?.is_open && canApply && (
            <Button asChild size="sm">
              <Link href={`/cabinet/applications/new?area=${area.code}`}>Müraciət et</Link>
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

// Filters a visitor sets by hand; "open" and "sort" alone do not count.
const EXPLICIT = ["purpose", "region", "rayon", "min", "max", "q", "fee_min", "fee_max", "inv_min", "inv_max"];

/** An investor's catalogue starts filtered by the budget and interests in their profile. */
function usePreferenceFilter(filters: AreaFilters, update: (patch: Partial<AreaFilters>) => void) {
  const params = useSearchParams();
  const { data: user } = useSession();
  const investor = user?.role === "INVESTOR";
  const { data: profile } = useProfile(investor);
  const applied = useRef(false);
  const interests = profile?.interests ?? [];
  const budget = profile?.budget_azn != null ? Number(profile.budget_azn) : null;
  const hasPrefs = interests.length > 0 || budget !== null;

  useEffect(() => {
    if (applied.current || !investor || profile === undefined) return;
    applied.current = true;
    if (!hasPrefs || EXPLICIT.some((k) => params.has(k))) return;
    update({ purposes: interests, invMax: budget, openOnly: true });
  }, [investor, profile, hasPrefs, interests, budget, params, update]);

  const same =
    hasPrefs &&
    filters.invMax === budget &&
    filters.purposes.length === interests.length &&
    interests.every((p) => filters.purposes.includes(p));
  return investor && same;
}

function CatalogueView() {
  const { filters, update, reset, active } = useAreaFilters();
  const byPreferences = usePreferenceFilter(filters, update);
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAreas(filters, page, PAGE_SIZE);
  useEffect(() => setPage(1), [filters]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">İnvestisiya imkanları kataloqu</h1>
          <p className="mt-1 text-sm text-ink-2">
            Müsabiqəyə çıxarılan təsərrüfat sahələri: ölçü, yerləşdiyi ərazi, istifadə şərtləri və son müraciət tarixi.
          </p>
        </div>
        <span className="text-13 text-ink-2">
          <span className="tabular font-medium text-ink">{data?.total ?? "…"}</span> sahə
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-md border border-border bg-surface p-4">
            <FilterPanel filters={filters} update={update} reset={reset} active={active} counts={data?.purpose_counts} />
          </div>
        </aside>
        <section>
          {byPreferences && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-primary/20 bg-primary-50 px-3 py-2 text-13 text-primary">
              <SlidersHorizontal className="size-4" aria-hidden />
              <span>Tərcihlərinizə görə filtrləndi. Soldan dəyişə bilərsiniz.</span>
              <button type="button" onClick={reset} className="ml-auto font-medium underline underline-offset-2">
                Bütün elanlar
              </button>
            </p>
          )}
          <ul className="divide-y divide-border rounded-md border border-border bg-surface">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="p-5">
                  <Skeleton className="h-16" />
                </li>
              ))}
            {data?.items.map((area) => <CatalogueRow key={area.code} area={area} />)}
            {data && data.items.length === 0 && (
              <li className="px-5 py-12 text-center text-sm text-ink-2">Bu filtrlərə uyğun sahə tapılmadı.</li>
            )}
          </ul>
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-13 text-ink-2" aria-label="Səhifələr">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft /> Əvvəlki
              </Button>
              <span className="tabular">
                {page} / {pages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Növbəti <ChevronRight />
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
