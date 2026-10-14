"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { type AreaDetail, type AreaFeatureCollection, useCompareAreas, useMapContext } from "@/features/areas/api";
import { useCompare } from "@/features/areas/compare-store";
import { IRRIGATION_LABEL } from "@/features/areas/selected-area-card";
import { formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#F1EEE8]" />
});

function featureOf(a: AreaDetail): AreaFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: a.geometry as unknown as GeoJSON.MultiPolygon,
        properties: {
          id: a.id,
          code: a.code,
          purpose: a.purpose,
          area_ha: Number(a.area_ha),
          rayon: a.rayon_name,
          village: a.village_name,
          open: !!a.competition?.is_open,
          deadline_at: a.competition?.deadline_at ?? null,
          fao_class: a.best_fao_class ?? null,
          demining: a.demining_status
        }
      }
    ]
  };
}

type Row = { label: string; value: (a: AreaDetail) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Yerləşdiyi ərazi", value: (a) => `${a.village_name ? `${a.village_name}, ` : ""}${a.rayon_name}` },
  { label: "Təyinat", value: (a) => <PurposeChip purpose={a.purpose} /> },
  { label: "Ölçü", value: (a) => formatHectares(Number(a.area_ha)) },
  { label: "Suvarma", value: (a) => IRRIGATION_LABEL[a.irrigation] },
  { label: "Torpaq", value: (a) => a.soil_type ?? "—" },
  {
    label: "Ən yaxın yaşayış məntəqəsi",
    value: (a) => (a.dist_village_m != null ? `${formatNumber(a.dist_village_m / 1000, 1)} km` : "—")
  },
  { label: "İcarə müddəti", value: (a) => `${a.lease_term_years} il` },
  {
    label: "İllik icarə haqqı",
    value: (a) =>
      a.annual_fee_azn_per_ha
        ? `${formatAzn(Number(a.annual_fee_azn_per_ha))}/ha · ${formatAzn(Number(a.annual_fee_azn_per_ha) * Number(a.area_ha))}/il`
        : "—"
  },
  { label: "Minimum investisiya", value: (a) => (a.min_investment_azn ? formatAzn(Number(a.min_investment_azn)) : "—") },
  {
    label: "Minatəmizləmə",
    value: (a) => (a.demining_status === "CLEARED" ? "Təmizlənib (nümayiş)" : "Davam edir (nümayiş)")
  },
  {
    label: "Müsabiqə",
    value: (a) =>
      a.competition ? (
        <span className="space-y-0.5">
          <Link href={`/competitions/${a.competition.number}`} className="block font-mono text-primary hover:underline">
            {a.competition.number}
          </Link>
          <span className="block text-ink-2">Son tarix: {formatDate(a.competition.deadline_at)}</span>
          <DeadlineBadge iso={a.competition.deadline_at} />
        </span>
      ) : (
        "Müsabiqəyə çıxarılmayıb"
      )
  },
  { label: "Uyğunluq", value: (a) => a.best_fao_class ?? "—" },
  { label: "İstifadə şərtləri", value: (a) => <span className="text-13 leading-relaxed text-ink-2">{a.conditions_of_use}</span> }
];

function CompareView() {
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
  const { data: context } = useMapContext();

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
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl">Sahələrin müqayisəsi</h1>
        <p className="mt-2 text-sm text-ink-2">Xəritədə və ya sahə səhifəsində “Müqayisəyə əlavə et” düyməsi ilə 2–3 sahə seçin.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">Xəritəyə keç</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <h1 className="text-2xl">Sahələrin müqayisəsi</h1>
      <p className="mt-1 text-sm text-ink-2">Ölçü, yerləşmə, istifadə şərtləri və müsabiqə məlumatları yan-yana.</p>

      <div className="mt-6 overflow-x-auto rounded-md border border-border bg-surface">
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
                <th className="bg-surface-2 px-4 py-3 text-left text-13 font-medium text-ink-2">Sahə</th>
                {areas.map((a) => (
                  <th key={a.code} className="px-4 py-3 text-left font-normal">
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
                        aria-label={`${a.code} müqayisədən çıxar`}
                        className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 h-36 overflow-hidden rounded-md border border-border">
                      <FarmMap features={featureOf(a)} context={context} compact className="h-full w-full" />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border align-top last:border-b-0">
                  <th scope="row" className="bg-surface-2 px-4 py-2.5 text-left text-13 font-medium text-ink-2">
                    {row.label}
                  </th>
                  {areas.map((a) => (
                    <td key={a.code} className="px-4 py-2.5 tabular text-ink">
                      {row.value(a)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th className="bg-surface-2 px-4 py-3" />
                {areas.map((a) => (
                  <td key={a.code} className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link href={`/areas/${a.code}`}>Ətraflı</Link>
                      </Button>
                      {a.competition?.is_open && (
                        <Button asChild size="sm">
                          <Link href={`/cabinet/applications/new?area=${a.code}`}>Müraciət et</Link>
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
