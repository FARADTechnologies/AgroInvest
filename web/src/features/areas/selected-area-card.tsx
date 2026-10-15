"use client";

import { ArrowUpRight, Droplets, Layers, MapPin, Mountain, Route, ShieldAlert, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PURPOSE_HEX, PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/panel";
import { useSession } from "@/features/auth/use-session";
import { useL, useLang, useT } from "@/lib/i18n";
import { cn, formatAzn, formatHectares, formatNumber } from "@/lib/utils";

import { useArea } from "./api";
import { PlotImage } from "./plot-image";
import { CompareButton } from "./compare-controls";
import { CROP_META, cropOf } from "./crops";

export const IRRIGATION_LABEL: Record<string, string> = {
  NONE: "Suvarma yoxdur",
  CANAL: "Kanal suvarması",
  WELL: "Subartezian quyusu",
  RIVER: "Çaydan suvarma"
};

const IRRIGATION_EN: Record<string, string> = {
  NONE: "No irrigation",
  CANAL: "Canal irrigation",
  WELL: "Artesian well",
  RIVER: "River irrigation"
};

/** Irrigation label in the interface language. */
export function useIrrigationLabel() {
  const { lang } = useLang();
  return (code: string) => (lang === "en" ? IRRIGATION_EN : IRRIGATION_LABEL)[code] ?? code;
}

const SUIT_BAR: Record<string, string> = { S1: "bg-suit-s1", S2: "bg-suit-s2", S3: "bg-suit-s3", N: "bg-suit-n" };

function Stat({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-2xs font-medium text-ink-3">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <div className="mt-0.5 truncate text-13 font-semibold text-ink">{value}</div>
    </div>
  );
}

/** Floating summary of the area picked on the map. */
export function SelectedAreaCard({
  code,
  geometry,
  onClose,
  className
}: {
  code: string;
  geometry?: GeoJSON.Geometry;
  onClose: () => void;
  className?: string;
}) {
  const t = useT();
  const L = useL();
  const { lang } = useLang();
  const irrigation = useIrrigationLabel();
  const { data: area, isLoading } = useArea(code);
  const { data: user } = useSession();
  const applyHref = `/cabinet/applications/new?area=${code}`;
  const crop = area ? CROP_META[cropOf(area)] : null;
  const CropIcon = crop?.icon;

  return (
    <motion.div
      key={code}
      initial={{ opacity: 0, x: 24, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn("glass flex max-h-full w-[360px] flex-col overflow-hidden rounded-3xl", className)}
    >
      {/* Satellite view of the plot with its boundary. */}
      <PlotImage
        geometry={geometry}
        color={area ? PURPOSE_HEX[area.purpose] : "#C6F36B"}
        width={360}
        height={150}
        pad={0.35}
        strokeWidth={2.5}
        className="shrink-0"
      >
        <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
        <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-2xs font-semibold text-white backdrop-blur">{code}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={L("Bağla", "Close")}
          className="absolute right-3 top-3 rounded-full bg-black/40 p-1.5 text-white backdrop-blur transition hover:bg-black/60"
        >
          <X className="size-4" />
        </button>
        {area && (
          <span className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-13 font-semibold text-primary-fg tabular">{formatHectares(Number(area.area_ha))}</span>
            {area.best_fao_class && <span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-13 font-semibold text-ink">{area.best_fao_class}</span>}
          </span>
        )}
      </PlotImage>

      <div className="px-4 pb-2 pt-3">
        {area ? <h2 className="text-15 leading-snug">{area.name_az}</h2> : <Skeleton className="h-5 w-44" />}
        {area && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-13 text-ink-2">
            <PurposeChip purpose={area.purpose} />
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {area.village_name ? `${area.village_name}, ` : ""}
                {area.rayon_name}
              </span>
            </span>
          </div>
        )}
      </div>

      {isLoading || !area ? (
        <div className="space-y-2 px-4 pb-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
            {area.competition && (
              <div className="rounded-2xl bg-primary p-3 text-13 text-primary-fg">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/competitions/${area.competition.number}`} className="whitespace-nowrap font-mono font-semibold text-accent hover:underline">
                    {area.competition.number}
                  </Link>
                  <DeadlineBadge iso={area.competition.deadline_at} className="text-white/80" />
                </div>
                <div className="mt-1 line-clamp-2 text-white/80">{area.competition.title_az}</div>
                {area.min_investment_azn && (
                  <div className="mt-2 flex items-baseline justify-between border-t border-white/10 pt-2">
                    <span className="text-white/60">{L("Minimum investisiya", "Minimum investment")}</span>
                    <span className="font-semibold tabular">{formatAzn(Number(area.min_investment_azn))}</span>
                  </div>
                )}
              </div>
            )}

            {area.demining_status !== "CLEARED" && (
              <div className="flex items-start gap-2 rounded-2xl bg-status-info-bg px-3 py-2 text-13 text-status-info-fg">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {L("Minatəmizləmə davam edir: sahə müsabiqəyə çıxarıla bilməz", "Demining in progress: the plot cannot be offered yet")}
              </div>
            )}

            {crop && CropIcon && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-2.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${crop.color}26`, color: crop.color }}>
                  <CropIcon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">{L("Tövsiyə olunan istifadə", "Recommended use")}</span>
                  <span className="block text-sm font-semibold">{lang === "en" ? crop.en : crop.az}</span>
                  <span className="block text-2xs leading-snug text-ink-3">{lang === "en" ? crop.whyEn : crop.whyAz}</span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Stat icon={Droplets} label={L("Suvarma", "Irrigation")} value={irrigation(area.irrigation)} />
              <Stat icon={Layers} label={L("Torpaq", "Soil")} value={area.soil_type ?? "—"} />
              <Stat
                icon={Mountain}
                label={L("Hündürlük · yamac", "Elevation · slope")}
                value={area.elevation_m != null ? `${formatNumber(area.elevation_m)} m · ${area.slope_deg ?? "—"}°` : "—"}
              />
              <Stat
                icon={Route}
                label={L("Yola məsafə", "To main road")}
                value={area.dist_road_m != null ? `${formatNumber(area.dist_road_m / 1000, 1)} km` : "—"}
              />
            </div>

            {area.suitability.length > 0 && (
              <div className="rounded-2xl bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between text-2xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {t.suitability.title} <span className="normal-case tracking-normal">0–100</span>
                </div>
                <ul className="space-y-2">
                  {area.suitability.map((s, i) => (
                    <li key={s.activity} className="grid grid-cols-[92px_1fr_36px] items-center gap-2 text-13">
                      <span className="truncate text-ink-2">{t.purpose[s.activity]}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <motion.span
                          className={cn("block h-full rounded-full", SUIT_BAR[s.fao_class])}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.score}%` }}
                          transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.08 }}
                        />
                      </span>
                      <span className="text-right font-semibold tabular">{s.fao_class === "N" ? "—" : s.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions stay in reach however long the details are. */}
          <div className="flex shrink-0 items-center gap-2 border-t border-white/60 bg-white/50 p-3">
            <CompareButton code={code} iconOnly />
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <Link href={`/areas/${code}`}>{L("Ətraflı", "Details")}</Link>
            </Button>
            {area.competition?.is_open && (
              <Button asChild variant="lime" size="sm" className="flex-1">
                <Link href={user ? applyHref : `/login?next=${encodeURIComponent(applyHref)}`}>
                  {L("Müraciət et", "Apply")} <ArrowUpRight />
                </Link>
              </Button>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
