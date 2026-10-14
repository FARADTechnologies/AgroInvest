"use client";

import { ChevronRight, FileText, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useMemo } from "react";

import { DEMINING_DEMO_NOTE } from "@/components/domain/area-status";
import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { SuitabilityPanel } from "@/components/domain/suitability-panel";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { type AreaFeatureCollection, useArea, useMapContext } from "@/features/areas/api";
import { CompareButton, CompareTray } from "@/features/areas/compare-controls";
import { IRRIGATION_LABEL } from "@/features/areas/selected-area-card";
import { useSession } from "@/features/auth/use-session";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#F1EEE8]" />
});

const SOURCE_LABEL: Record<string, string> = {
  OSM: "OpenStreetMap kənd təsərrüfatı poliqonu",
  SYNTHETIC: "Nümayiş üçün yaradılmış poliqon",
  MANUAL: "Mütəxəssis tərəfindən daxil edilib",
  EKTIS: "EKTİS parsel reyestri"
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-2.5 last:border-b-0 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-13 text-ink-3">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function AreaDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { data: area, isLoading, error } = useArea(code.toUpperCase());
  const { data: context } = useMapContext();
  const { data: user } = useSession();

  const features = useMemo<AreaFeatureCollection | undefined>(
    () =>
      area && {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: area.geometry as unknown as GeoJSON.MultiPolygon,
            properties: {
              id: area.id,
              code: area.code,
              purpose: area.purpose,
              area_ha: Number(area.area_ha),
              rayon: area.rayon_name,
              village: area.village_name,
              open: !!area.competition?.is_open,
              deadline_at: area.competition?.deadline_at ?? null,
              fao_class: area.best_fao_class ?? null,
              demining: area.demining_status
            }
          }
        ]
      },
    [area]
  );

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl">Sahə tapılmadı</h1>
        <p className="mt-2 text-ink-2">Kod: {code}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">Xəritəyə qayıt</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !area) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 lg:px-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const comp = area.competition;
  const ha = Number(area.area_ha);
  const applyHref = `/cabinet/applications/new?area=${area.code}`;
  const cleared = area.demining_status === "CLEARED";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/map" className="hover:text-ink">Xəritə</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/map?rayon=${area.rayon_id}`} className="hover:text-ink">{area.rayon_name}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{area.code}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-sm text-ink-3">{area.code}</div>
          <h1 className="text-2xl">{area.name_az}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PurposeChip purpose={area.purpose} />
            <span className="rounded-sm border border-border bg-surface px-2 py-1 text-13 font-medium tabular">
              {formatHectares(ha)}
            </span>
            <span
              title={DEMINING_DEMO_NOTE}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-13 font-medium",
                cleared ? "bg-status-won-bg text-status-won-fg" : "bg-status-info-bg text-status-info-fg"
              )}
            >
              {cleared ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
              {cleared ? "Minatəmizləmə: təmizlənib" : "Minatəmizləmə davam edir"}
              <span className="font-normal opacity-80">· nümayiş</span>
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-13 text-ink-3"
          title="Prototipdə sahə, müsabiqə və minatəmizləmə məlumatları nümayiş məqsədlidir"
        >
          <Info className="size-3.5" aria-hidden /> Demo məlumatı
        </span>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader>
              <PanelTitle>Əsas göstəricilər</PanelTitle>
            </PanelHeader>
            <PanelBody className="py-1">
              <dl>
                <Fact label="Yerləşdiyi ərazi">
                  {area.village_name ? `${area.village_name} kəndi, ` : ""}
                  {area.rayon_name} rayonu
                </Fact>
                <Fact label="Ölçüsü">{formatHectares(ha)}</Fact>
                <Fact label="Təyinatı">
                  <PurposeChip purpose={area.purpose} />
                </Fact>
                <Fact label="Suvarma">{IRRIGATION_LABEL[area.irrigation]}</Fact>
                {area.soil_type && <Fact label="Torpaq">{area.soil_type}</Fact>}
                {area.dist_village_m != null && (
                  <Fact label="Ən yaxın yaşayış məntəqəsi">
                    {formatNumber(area.dist_village_m / 1000, 1)} km
                  </Fact>
                )}
                {area.dist_water_m != null && (
                  <Fact label="Su mənbəyinə məsafə">{formatNumber(area.dist_water_m / 1000, 1)} km</Fact>
                )}
                {area.dist_road_m != null && (
                  <Fact label="Əsas yola məsafə">{formatNumber(area.dist_road_m / 1000, 1)} km</Fact>
                )}
                <Fact label="İcarə müddəti">{area.lease_term_years} il</Fact>
                {area.annual_fee_azn_per_ha && (
                  <Fact label="İllik icarə haqqı">
                    {formatAzn(Number(area.annual_fee_azn_per_ha))} / ha · təxminən{" "}
                    {formatAzn(Number(area.annual_fee_azn_per_ha) * ha)} / il
                  </Fact>
                )}
                <Fact label="Minatəmizləmə">
                  {cleared
                    ? "Nümayiş statusu: təmizlənmiş kimi qeyd olunub."
                    : "Nümayiş statusu: davam edir, sahə müsabiqəyə çıxarıla bilməz."}
                  <span className="mt-0.5 block text-13 text-ink-3">
                    Real status ANAMA məlumatları ilə inteqrasiyadan sonra göstəriləcək.
                  </span>
                </Fact>
                <Fact label="Məlumat mənbəyi">{SOURCE_LABEL[area.data_source]}</Fact>
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>İstifadə şərtləri</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-sm leading-relaxed text-ink">{area.conditions_of_use}</p>
            </PanelBody>
          </Panel>

          {area.suitability.length > 0 && <SuitabilityPanel items={area.suitability} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="h-56 overflow-hidden rounded-md border border-border">
            <FarmMap features={features} context={context} compact className="h-full w-full" />
          </div>
          <CompareButton code={area.code} className="w-full" />

          {comp ? (
            <Panel>
              <PanelBody className="space-y-3">
                <div>
                  <Link href={`/competitions/${comp.number}`} className="font-mono text-13 font-medium text-primary hover:underline">
                    {comp.number}
                  </Link>
                  <p className="mt-0.5 text-sm font-medium text-ink">{comp.title_az}</p>
                </div>
                <div className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2 text-13">
                  <span className="text-ink-2">Son müraciət: {formatDate(comp.deadline_at)}</span>
                  <DeadlineBadge iso={comp.deadline_at} />
                </div>
                {area.min_investment_azn && (
                  <p className="text-13 text-ink-2">
                    Minimum investisiya: <span className="font-medium text-ink">{formatAzn(Number(area.min_investment_azn))}</span>
                  </p>
                )}
                {comp.is_open ? (
                  <Button asChild size="lg" className="w-full">
                    <Link href={user ? applyHref : `/login?next=${encodeURIComponent(applyHref)}`}>Müraciət et</Link>
                  </Button>
                ) : (
                  <p className="rounded-md border border-border px-3 py-2 text-13 text-ink-2">
                    Bu müsabiqə üzrə müraciət qəbulu başa çatıb.
                  </p>
                )}
              </PanelBody>
            </Panel>
          ) : (
            <Panel>
              <PanelBody className="text-sm text-ink-2">
                {cleared
                  ? "Sahə hələ müsabiqəyə çıxarılmayıb. Müsabiqə elan edildikdə burada görünəcək."
                  : "Minatəmizləmə başa çatdıqdan sonra sahə müsabiqəyə çıxarıla bilər."}
              </PanelBody>
            </Panel>
          )}

          {area.required_documents.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Tələb olunan sənədlər</PanelTitle>
              </PanelHeader>
              <ul className="divide-y divide-border">
                {area.required_documents.map((d) => (
                  <li key={d.code} className="flex gap-2.5 px-4 py-2.5 text-sm">
                    <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <span>
                      {d.name_az}
                      {!d.mandatory && <span className="text-ink-3"> (könüllü)</span>}
                      {d.applies_to !== "ANY" && (
                        <span className="block text-13 text-ink-3">
                          {d.applies_to === "COMPANY" ? "Hüquqi şəxslər üçün" : "Fiziki şəxslər üçün"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
      <CompareTray className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,560px)] -translate-x-1/2" />
    </div>
  );
}
