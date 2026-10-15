"use client";

import { ChevronRight, FileText, Info, Map as MapIcon, ShieldAlert, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { use, useMemo } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { SuitabilityPanel } from "@/components/domain/suitability-panel";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { type AreaFeatureCollection, useArea, useMapContext } from "@/features/areas/api";
import { CompareButton, CompareTray } from "@/features/areas/compare-controls";
import { useIrrigationLabel } from "@/features/areas/selected-area-card";
import { useL } from "@/lib/i18n";
import { useSession } from "@/features/auth/use-session";
import { ForecastCard } from "@/features/weather/forecast-card";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#1B2A1F]" />
});

const SOURCE_EN: Record<string, string> = {
  OSM: "OpenStreetMap farmland polygon",
  SYNTHETIC: "Polygon generated for the demo",
  MANUAL: "Entered by a specialist",
  EKTIS: "EKTIS parcel register"
};

const SOURCE_LABEL: Record<string, string> = {
  OSM: "OpenStreetMap kənd təsərrüfatı poliqonu",
  SYNTHETIC: "Nümayiş üçün yaradılmış poliqon",
  MANUAL: "Mütəxəssis tərəfindən daxil edilib",
  EKTIS: "EKTİS parsel reyestri"
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 py-3 last:border-b-0 sm:grid sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-13 text-ink-3">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function AreaDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const L = useL();
  const irrigation = useIrrigationLabel();
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
        <h1 className="text-xl">{L("Sahə tapılmadı", "Plot not found")}</h1>
        <p className="mt-2 text-ink-2">Kod: {code}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">{L("Xəritəyə qayıt", "Back to the map")}</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !area) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-8 lg:px-8">
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
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/map" className="hover:text-ink">{L("Xəritə", "Map")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/map?rayon=${area.rayon_id}`} className="hover:text-ink">{area.rayon_name}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{area.code}</span>
      </nav>

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-3 flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <div className="inline-flex rounded-full bg-primary-50 px-3 py-1 font-mono text-13 font-semibold text-primary">{area.code}</div>
          <h1 className="mt-2 text-[32px] leading-tight tracking-[-0.03em]">{area.name_az}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <PurposeChip purpose={area.purpose} />
            <span className="rounded-full bg-primary px-3 py-1 text-13 font-semibold text-primary-fg tabular">
              {formatHectares(ha)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-13 font-medium",
                cleared ? "bg-status-won-bg text-status-won-fg" : "bg-status-info-bg text-status-info-fg"
              )}
            >
              {cleared ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
              {cleared ? L("Minalardan təmizlənib", "Cleared of mines") : L("Minatəmizləmə davam edir", "Demining in progress")}
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 text-13 text-ink-3"
          title={L("Prototipdə sahə, müsabiqə və minatəmizləmə məlumatları nümayiş məqsədlidir", "Plot, competition and demining data in the prototype is for demonstration")}
        >
          <Info className="size-3.5" aria-hidden /> {L("Demo məlumatı", "Demo data")}
        </span>
      </motion.header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Əsas göstəricilər", "Key facts")}</PanelTitle>
            </PanelHeader>
            <PanelBody className="py-1">
              <dl>
                <Fact label={L("Yerləşdiyi ərazi", "Location")}>
                  {area.village_name ? L(`${area.village_name} kəndi, `, `${area.village_name} village, `) : ""}
                  {area.rayon_name} rayonu
                </Fact>
                <Fact label={L("Ölçüsü", "Size")}>{formatHectares(ha)}</Fact>
                <Fact label={L("Təyinatı", "Purpose")}>
                  <PurposeChip purpose={area.purpose} />
                </Fact>
                <Fact label={L("Suvarma", "Irrigation")}>{irrigation(area.irrigation)}</Fact>
                {area.soil_type && <Fact label="Torpaq">{area.soil_type}</Fact>}
                {area.dist_village_m != null && (
                  <Fact label={L("Ən yaxın yaşayış məntəqəsi", "Nearest settlement")}>
                    {formatNumber(area.dist_village_m / 1000, 1)} km
                  </Fact>
                )}
                {area.dist_water_m != null && (
                  <Fact label={L("Su mənbəyinə məsafə", "Distance to water")}>{formatNumber(area.dist_water_m / 1000, 1)} km</Fact>
                )}
                {area.dist_road_m != null && (
                  <Fact label={L("Əsas yola məsafə", "Distance to main road")}>{formatNumber(area.dist_road_m / 1000, 1)} km</Fact>
                )}
                <Fact label={L("İcarə müddəti", "Lease term")}>{area.lease_term_years} {L("il", "years")}</Fact>
                {area.annual_fee_azn_per_ha && (
                  <Fact label={L("İllik icarə haqqı", "Annual lease fee")}>
                    {formatAzn(Number(area.annual_fee_azn_per_ha))} / ha · {L("təxminən", "about")}{" "}
                    {formatAzn(Number(area.annual_fee_azn_per_ha) * ha)} / il
                  </Fact>
                )}
                <Fact label={L("Minatəmizləmə", "Demining")}>
                  {cleared && area.demining_certified_on
                    ? L(`Təmizlənib, sertifikat ${formatDate(area.demining_certified_on)}`, `Cleared, certificate ${formatDate(area.demining_certified_on)}`)
                    : L("Davam edir: sahə müsabiqəyə çıxarıla bilməz", "In progress: the plot cannot be offered yet")}
                </Fact>
                <Fact label={L("Məlumat mənbəyi", "Data source")}>{L(SOURCE_LABEL[area.data_source], SOURCE_EN[area.data_source])}</Fact>
              </dl>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>{L("İstifadə şərtləri", "Terms of use")}</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-sm leading-relaxed text-ink">{area.conditions_of_use}</p>
            </PanelBody>
          </Panel>

          {area.suitability.length > 0 && <SuitabilityPanel items={area.suitability} />}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="relative h-72 overflow-hidden rounded-3xl border border-border/70 shadow-card"
          >
            <FarmMap features={features} context={context} compact basemap="satellite" className="h-full w-full" />
            <Link
              href={`/map?area=${area.code}`}
              className="glass absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-13 font-semibold text-ink"
            >
              <MapIcon className="size-3.5" aria-hidden /> {L("Böyük xəritədə aç", "Open on the full map")}
            </Link>
          </motion.div>
          {area.centroid?.length === 2 && (
            <ForecastCard point={[area.centroid[0], area.centroid[1]]} place={area.village_name ?? area.rayon_name} className="w-full" />
          )}
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
                <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-13">
                  <span className="text-ink-2">{L("Son müraciət", "Deadline")}: {formatDate(comp.deadline_at)}</span>
                  <DeadlineBadge iso={comp.deadline_at} />
                </div>
                {area.min_investment_azn && (
                  <p className="text-13 text-ink-2">
                    Minimum investisiya: <span className="font-medium text-ink">{formatAzn(Number(area.min_investment_azn))}</span>
                  </p>
                )}
                {comp.is_open ? (
                  <Button asChild variant="lime" size="lg" className="w-full">
                    <Link href={user ? applyHref : `/login?next=${encodeURIComponent(applyHref)}`}>{L("Müraciət et", "Apply")}</Link>
                  </Button>
                ) : (
                  <p className="rounded-2xl border border-border px-3 py-2 text-13 text-ink-2">
                    {L("Bu müsabiqə üzrə müraciət qəbulu başa çatıb.", "Applications for this competition are closed.")}
                  </p>
                )}
              </PanelBody>
            </Panel>
          ) : (
            <Panel>
              <PanelBody className="text-sm text-ink-2">
                {cleared
                  ? L("Sahə hələ müsabiqəyə çıxarılmayıb. Müsabiqə elan edildikdə burada görünəcək.", "The plot is not offered yet. A competition will show here once announced.")
                  : L("Minatəmizləmə başa çatdıqdan sonra sahə müsabiqəyə çıxarıla bilər.", "The plot can be offered once demining is complete.")}
              </PanelBody>
            </Panel>
          )}

          {area.required_documents.length > 0 && (
            <Panel>
              <PanelHeader>
                <PanelTitle>{L("Tələb olunan sənədlər", "Required documents")}</PanelTitle>
              </PanelHeader>
              <ul className="divide-y divide-border">
                {area.required_documents.map((d) => (
                  <li key={d.code} className="flex gap-2.5 px-4 py-2.5 text-sm">
                    <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <span>
                      {d.name_az}
                      {!d.mandatory && <span className="text-ink-3"> ({L("könüllü", "optional")})</span>}
                      {d.applies_to !== "ANY" && (
                        <span className="block text-13 text-ink-3">
                          {d.applies_to === "COMPANY" ? L("Hüquqi şəxslər üçün", "For companies") : L("Fiziki şəxslər üçün", "For individuals")}
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
      <div className="fixed bottom-4 left-1/2 z-30 w-[min(92vw,560px)] -translate-x-1/2">
        <CompareTray />
      </div>
    </div>
  );
}
