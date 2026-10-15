"use client";

import { GitCompareArrows, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PURPOSE_HEX, PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/panel";
import { type AreaDetail, useCompareAreas } from "@/features/areas/api";
import { PlotImage } from "@/features/areas/plot-image";
import { useCompare } from "@/features/areas/compare-store";
import { useIrrigationLabel } from "@/features/areas/selected-area-card";
import { useL } from "@/lib/i18n";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

type Row = {
  label: string;
  value: (a: AreaDetail) => React.ReactNode;
  /** Numeric score for the row, so the most favourable area can be marked. */
  score?: (a: AreaDetail) => number | null;
  better?: "max" | "min";
};

type Tr = (az: string, en: string) => string;

function buildRows(L: Tr, irrigation: (code: string) => string): Row[] {
  return [
  { label: L("Yerləşdiyi ərazi", "Location"), value: (a) => `${a.village_name ? `${a.village_name}, ` : ""}${a.rayon_name}` },
  { label: L("Təyinat", "Purpose"), value: (a) => <PurposeChip purpose={a.purpose} /> },
  { label: L("Ölçü", "Size"), value: (a) => formatHectares(Number(a.area_ha)), score: (a) => Number(a.area_ha), better: "max" },
  { label: L("Suvarma", "Irrigation"), value: (a) => irrigation(a.irrigation) },
  { label: L("Torpaq", "Soil"), value: (a) => a.soil_type ?? "—" },
  {
    label: L("Ən yaxın yaşayış məntəqəsi", "Nearest settlement"),
    value: (a) => (a.dist_village_m != null ? `${formatNumber(a.dist_village_m / 1000, 1)} km` : "—"),
    score: (a) => a.dist_village_m,
    better: "min"
  },
  { label: L("İcarə müddəti", "Lease term"), value: (a) => `${a.lease_term_years} ${L("il", "years")}` },
  {
    label: L("İllik icarə haqqı", "Annual lease fee"),
    value: (a) =>
      a.annual_fee_azn_per_ha
        ? `${formatAzn(Number(a.annual_fee_azn_per_ha))}/ha · ${formatAzn(Number(a.annual_fee_azn_per_ha) * Number(a.area_ha))}/${L("il", "yr")}`
        : "—",
    score: (a) => (a.annual_fee_azn_per_ha ? Number(a.annual_fee_azn_per_ha) : null),
    better: "min"
  },
  {
    label: L("Minimum investisiya", "Minimum investment"),
    value: (a) => (a.min_investment_azn ? formatAzn(Number(a.min_investment_azn)) : "—"),
    score: (a) => (a.min_investment_azn ? Number(a.min_investment_azn) : null),
    better: "min"
  },
  {
    label: L("Minatəmizləmə", "Demining"),
    value: (a) => (a.demining_status === "CLEARED" ? L("Minalardan təmizlənib", "Cleared of mines") : L("Minatəmizləmə davam edir", "Demining in progress"))
  },
  {
    label: L("Müsabiqə", "Competition"),
    value: (a) =>
      a.competition ? (
        <span className="space-y-0.5">
          <Link href={`/competitions/${a.competition.number}`} className="block font-mono text-primary hover:underline">
            {a.competition.number}
          </Link>
          <span className="block text-ink-2">{L("Son tarix", "Deadline")}: {formatDate(a.competition.deadline_at)}</span>
          <DeadlineBadge iso={a.competition.deadline_at} />
        </span>
      ) : (
        L("Müsabiqəyə çıxarılmayıb", "Not offered yet")
      )
  },
  {
    label: L("Uyğunluq", "Suitability"),
    value: (a) => a.best_fao_class ?? "—",
    score: (a) => (a.best_fao_class ? 4 - ["S1", "S2", "S3", "N"].indexOf(a.best_fao_class) : null),
    better: "max"
  },
  { label: L("İstifadə şərtləri", "Terms of use"), value: (a) => <span className="text-13 leading-relaxed text-ink-2">{a.conditions_of_use}</span> }
  ];
}

function CompareView() {
  const L = useL();
  const irrigation = useIrrigationLabel();
  const ROWS = buildRows(L, irrigation);
  const params = useSearchParams();
  const router = useRouter();
  const { codes: stored, remove } = useCompare();
  const urlCodes = params.get("codes") ?? "";
  const fromUrl = useMemo(
    () => urlCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    [urlCodes]
  );
  const codes = useMemo(() => (fromUrl.length ? fromUrl : stored).slice(0, 3), [fromUrl, stored]);
  const { data: areas, isLoading } = useCompareAreas(codes);

  // Keep the URL shareable and in step with the stored list.
  useEffect(() => {
    if (!fromUrl.length && stored.length) router.replace(`/compare?codes=${stored.join(",")}`, { scroll: false });
  }, [fromUrl.length, stored, router]);

  const drop = (code: string) => {
    remove(code);
    const next = codes.filter((c) => c !== code);
    router.replace(next.length ? `/compare?codes=${next.join(",")}` : "/compare", { scroll: false });
  };

  if (codes.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-primary-50 text-primary">
          <GitCompareArrows className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl">{L("Sahələrin müqayisəsi", "Compare plots")}</h1>
        <p className="mt-2 text-sm text-ink-2">{L("Xəritədə və ya sahə səhifəsində “Müqayisəyə əlavə et” düyməsi ilə 2–3 sahə seçin.", "Pick 2–3 plots with “Add to compare” on the map or a plot page.")}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">{L("Xəritəyə keç", "Go to the map")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow={L("Müqayisə", "Compare")}
        title={L("Sahələrin müqayisəsi", "Compare plots")}
        description={L("Ölçü, yerləşmə, istifadə şərtləri və müsabiqə məlumatları yan-yana. Hər sətirdə ən sərfəli göstərici işarələnib.", "Size, location, terms and competition details side by side. The best value in each row is marked.")}
      />

      <div className="mt-6 overflow-x-auto rounded-3xl border border-border/70 bg-surface shadow-card">
        {isLoading || !areas ? (
          <Skeleton className="m-4 h-96" />
        ) : (
          <table className="w-full min-w-[720px] table-fixed text-sm">
            <colgroup>
              <col className="w-48" />
              {areas.map((a) => (
                <col key={a.code} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-border align-top">
                <th className="bg-surface-2/70 px-5 py-4 text-left text-13 font-medium text-ink-2">{L("Sahə", "Plot")}</th>
                {areas.map((a) => (
                  <th key={a.code} className="px-5 py-4 text-left font-normal">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/areas/${a.code}`} className="font-mono text-13 font-medium text-primary hover:underline">
                          {a.code}
                        </Link>
                        <div className="text-15 font-semibold text-ink">{a.name_az}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => drop(a.code)}
                        aria-label={L(`${a.code} müqayisədən çıxar`, `Remove ${a.code}`)}
                        className="rounded-full p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-2xl">
                      <PlotImage geometry={a.geometry as unknown as GeoJSON.Geometry} color={PURPOSE_HEX[a.purpose]} width={320} height={160} pad={0.5} strokeWidth={2.5} className="w-full" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const scores = row.score ? areas.map((a) => row.score!(a)) : [];
                const valid = scores.filter((v): v is number => v != null);
                const best = valid.length > 1 && new Set(valid).size > 1 ? (row.better === "min" ? Math.min(...valid) : Math.max(...valid)) : null;
                return (
                  <tr key={row.label} className="border-t border-border/60 align-top">
                    <th scope="row" className="bg-surface-2/70 px-5 py-3 text-left text-13 font-medium text-ink-2">
                      {row.label}
                    </th>
                    {areas.map((a, i) => {
                      const top = best !== null && scores[i] === best;
                      return (
                        <td key={a.code} className={cn("px-5 py-3 tabular text-ink transition-colors", top && "bg-accent-50")}>
                          <span className="flex flex-wrap items-center gap-2">
                            {row.value(a)}
                            {top && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-2xs font-bold text-ink">
                                <Trophy className="size-3" aria-hidden /> {L("Ən sərfəli", "Best")}
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr>
                <th className="bg-surface-2/70 px-5 py-4" />
                {areas.map((a) => (
                  <td key={a.code} className="border-t border-border/60 px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/areas/${a.code}`}>{L("Ətraflı", "Details")}</Link>
                      </Button>
                      {a.competition?.is_open && (
                        <Button asChild variant="lime" size="sm">
                          <Link href={`/cabinet/applications/new?area=${a.code}`}>{L("Müraciət et", "Apply")}</Link>
                        </Button>
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
