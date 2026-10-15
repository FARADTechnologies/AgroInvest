"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CircleAlert,
  Clock,
  FileText,
  Map as MapIcon,
  Plus,
  ScanSearch,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo } from "react";

import { PURPOSE_HEX, PurposeIcon } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, EASE, Stagger, StaggerItem } from "@/components/ui/motion";
import { Panel, Skeleton } from "@/components/ui/panel";
import { type ApplicationSummary, useMyApplications, useNotifications, useProfile } from "@/features/applications/api";
import { type AreaListItem, useAreaFeatures, useAreas, useCompetitions } from "@/features/areas/api";
import { AreaShape } from "@/features/areas/area-shape";
import type { AreaFilters } from "@/features/areas/filters";
import { useSession } from "@/features/auth/use-session";
import { useL, useT } from "@/lib/i18n";
import { cn, daysUntil, formatAzn, formatDate, formatDateTime, formatHectares, formatNumber } from "@/lib/utils";

const OPEN_AREAS: AreaFilters = {
  purposes: [], region: "", rayonId: null, minHa: null, maxHa: null, openOnly: true, q: "", sort: "deadline"
};


/** Where an application is on the road to a decision: 0..3 filled segments and their tone. */
function progressOf(a: ApplicationSummary): { filled: number; tone: string } {
  switch (a.status) {
    case "DRAFT":
      return { filled: 0, tone: "bg-status-draft-fg" };
    case "RECEIVED":
      return { filled: 1, tone: "bg-status-received-fg" };
    case "UNDER_REVIEW":
      return { filled: 2, tone: "bg-status-review-fg" };
    case "INFO_REQUESTED":
      return { filled: 2, tone: "bg-status-info-fg" };
    default:
      return { filled: 3, tone: a.outcome === "REJECTED" ? "bg-status-rejected-fg" : "bg-status-won-fg" };
  }
}

function greeting(L: (az: string, en: string) => string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Baku" }).format(new Date()));
  return h < 12 ? L("Sabahınız xeyir", "Good morning") : h < 18 ? L("Günortanız xeyir", "Good afternoon") : L("Axşamınız xeyir", "Good evening");
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  href
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "dark" | "lime" | "warn";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-3xl border p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-float",
        tone === "dark" && "border-transparent bg-primary text-white",
        tone === "lime" && "border-transparent bg-accent text-ink",
        tone === "warn" && "border-status-info-fg/20 bg-status-info-bg text-ink",
        tone === "default" && "border-border/70 bg-surface shadow-card"
      )}
    >
      {tone === "dark" && (
        <svg className="absolute -right-6 -top-6 size-40 text-white/5" viewBox="0 0 100 100" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx="50" cy="50" r={10 + i * 8} fill="none" stroke="currentColor" strokeWidth="3" />
          ))}
        </svg>
      )}
      <div className="relative flex items-start justify-between">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl",
            tone === "dark" ? "bg-white/10 text-accent" : tone === "lime" ? "bg-primary text-accent" : tone === "warn" ? "bg-white text-status-info-fg" : "bg-primary-50 text-primary"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        {href && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-transform duration-300 ease-spring group-hover:rotate-45",
              tone === "dark" ? "bg-white/10" : "bg-white/70"
            )}
          >
            <ArrowUpRight className="size-4" />
          </span>
        )}
      </div>
      <div className="relative mt-5 text-4xl font-semibold tracking-[-0.03em]">
        <AnimatedNumber value={value} />
      </div>
      <div className={cn("relative mt-1 text-sm font-medium", tone === "dark" ? "text-white/80" : "text-ink")}>{label}</div>
      <div className={cn("relative text-13", tone === "dark" ? "text-white/50" : tone === "default" ? "text-ink-3" : "text-ink/60")}>{hint}</div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function ApplicationRow({ a, index }: { a: ApplicationSummary; index: number }) {
  const t = useT();
  const L = useL();
  const TRACK = [L("Göndərildi", "Submitted"), L("Baxılır", "Review"), L("Qərar", "Decision")];
  const { filled, tone } = progressOf(a);
  const href = a.status === "DRAFT" ? `/cabinet/applications/new?area=${a.area_code}&id=${a.id}` : `/cabinet/applications/${a.id}`;
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: 0.15 + index * 0.06 }}
    >
      <Link href={href} className="group grid gap-4 rounded-2xl p-3 transition-colors hover:bg-surface-2/80 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `${PURPOSE_HEX[a.purpose]}22`, color: PURPOSE_HEX[a.purpose] }}
          >
            <PurposeIcon purpose={a.purpose} className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{a.number ?? "Qaralama"}</span>
              <StatusBadge status={a.status} outcome={a.outcome} />
            </div>
            <div className="mt-0.5 truncate text-13 text-ink-2">
              {a.area_code} · {a.area_name} · {a.rayon_name} · {t.purpose[a.purpose]} · {formatHectares(Number(a.area_ha))}
            </div>
          </div>
        </div>
        <div>
          <div className="flex gap-1">
            {TRACK.map((step, i) => (
              <span key={step} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" title={step}>
                <motion.span
                  className={cn("block h-full rounded-full", tone)}
                  initial={{ width: 0 }}
                  animate={{ width: i < filled ? "100%" : "0%" }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.4 + index * 0.06 + i * 0.12 }}
                />
              </span>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-2xs text-ink-3">
            {TRACK.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 text-13 text-ink-2 sm:justify-end">
          <span className="text-right">
            {a.investment_azn && <span className="block font-semibold text-ink tabular">{formatAzn(Number(a.investment_azn))}</span>}
            <span className="block text-2xs text-ink-3">{a.submitted_at ? formatDate(a.submitted_at) : L("Göndərilməyib", "Not submitted")}</span>
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-all duration-300 group-hover:bg-primary group-hover:text-accent">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </Link>
    </motion.li>
  );
}

function DeadlineRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="5" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={pct > 80 ? "rgb(var(--status-info-fg))" : "rgb(var(--primary))"}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ duration: 1, ease: EASE, delay: 0.3 }}
      />
    </svg>
  );
}

function RecommendedArea({ area, geometry }: { area: AreaListItem; geometry?: GeoJSON.Geometry }) {
  const t = useT();
  return (
    <Link
      href={`/map?area=${area.code}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-float"
    >
      <div className="relative h-36 overflow-hidden bg-[#2E4A33] p-5">
        <span
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "repeating-linear-gradient(115deg, #4E6B3F 0 6px, #3A5530 6px 14px)" }}
          aria-hidden
        />
        <AreaShape geometry={geometry} color={PURPOSE_HEX[area.purpose]} className="relative transition-transform duration-700 ease-spring group-hover:scale-110" strokeWidth={2.4} />
        <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 font-mono text-2xs font-bold text-ink">{area.best_fao_class}</span>
        <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-all duration-300 group-hover:rotate-45 group-hover:bg-accent group-hover:text-ink">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="font-mono text-2xs text-ink-3">{area.code}</div>
        <div className="truncate text-sm font-semibold">{area.name_az}</div>
        <div className="mt-auto flex items-center justify-between pt-3 text-13">
          <span className="inline-flex items-center gap-1 text-ink-2">
            <PurposeIcon purpose={area.purpose} /> {t.purpose[area.purpose]}
          </span>
          <span className="font-semibold tabular">{formatHectares(Number(area.area_ha))}</span>
        </div>
      </div>
    </Link>
  );
}

export default function CabinetHome() {
  const L = useL();
  const { data: user } = useSession();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: apps, isLoading } = useMyApplications();
  const { data: notes } = useNotifications();
  const { data: comps } = useCompetitions();
  const { data: open } = useAreas(OPEN_AREAS, 1, 60);
  const { data: openFeatures } = useAreaFeatures(OPEN_AREAS);

  const stats = useMemo(() => {
    const list = apps ?? [];
    return {
      total: list.length,
      review: list.filter((a) => a.status === "RECEIVED" || a.status === "UNDER_REVIEW").length,
      info: list.filter((a) => a.status === "INFO_REQUESTED").length,
      won: list.filter((a) => a.outcome === "WON").length,
      investment: list.reduce((s, a) => s + Number(a.investment_azn ?? 0), 0),
      jobs: list.reduce((s, a) => s + (a.jobs_planned ?? 0), 0)
    };
  }, [apps]);

  const infoApp = apps?.find((a) => a.status === "INFO_REQUESTED");
  const applied = new Set((apps ?? []).map((a) => a.area_code));
  const recommended = (open?.items ?? [])
    .filter((a) => !applied.has(a.code) && (a.best_fao_class === "S1" || a.best_fao_class === "S2"))
    .sort((a, b) => (a.best_fao_class ?? "").localeCompare(b.best_fao_class ?? "") || Number(b.area_ha) - Number(a.area_ha))
    .slice(0, 4);
  const geometries = new Map((openFeatures?.features ?? []).map((f) => [f.properties.code, f.geometry as GeoJSON.Geometry]));
  const deadlines = (comps ?? [])
    .filter((c) => c.is_open)
    .sort((a, b) => a.deadline_at.localeCompare(b.deadline_at))
    .slice(0, 3);
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-sm font-medium text-ink-3">
            {greeting(L)} · {formatDate(new Date().toISOString())}
          </p>
          <h1 className="mt-1 text-[32px] leading-tight tracking-[-0.03em] sm:text-[40px]">
            {L("Xoş gəldiniz", "Welcome")}, <span className="text-primary">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-ink-2">{L("Müraciətlərinizin vəziyyəti, son tarixlər və sizə uyğun sahələr bir yerdə.", "Your applications, upcoming deadlines and plots that suit you, in one place.")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/map">
              <MapIcon /> {L("Xəritə", "Map")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/catalogue?open=1">
              <Plus /> {L("Yeni müraciət", "New application")}
            </Link>
          </Button>
        </div>
      </motion.header>

      {!profileLoading && !profile && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-status-info-fg/20 bg-status-info-bg px-5 py-4 text-sm text-status-info-fg"
        >
          <span className="flex items-center gap-2 font-medium">
            <CircleAlert className="size-5" aria-hidden /> {L("Müraciət etmək üçün sahibkar məlumatlarını doldurun.", "Fill in your applicant details to apply.")}
          </span>
          <Button asChild size="sm">
            <Link href="/cabinet/profile">{L("Məlumatları doldur", "Fill in details")}</Link>
          </Button>
        </motion.div>
      )}

      <Stagger step={0.07} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem className="h-full">
          <div className="relative h-full overflow-hidden rounded-3xl bg-primary p-5 text-white">
            <svg className="absolute -bottom-10 -right-10 size-56 text-white/[0.06]" viewBox="0 0 100 100" aria-hidden>
              {Array.from({ length: 7 }).map((_, i) => (
                <path key={i} d={`M0 ${30 + i * 10} C 30 ${20 + i * 10}, 60 ${40 + i * 10}, 100 ${28 + i * 10}`} stroke="currentColor" strokeWidth="4" fill="none" />
              ))}
            </svg>
            <span className="relative flex size-11 items-center justify-center rounded-2xl bg-white/10 text-accent">
              <TrendingUp className="size-5" aria-hidden />
            </span>
            <div className="relative mt-5 text-4xl font-semibold tracking-[-0.03em]">
              <AnimatedNumber value={stats.investment / 1000} />
              <span className="ml-1 text-lg font-medium text-white/60">{L("min AZN", "k AZN")}</span>
            </div>
            <div className="relative mt-1 text-sm font-medium text-white/80">{L("Planlaşdırılan investisiya", "Planned investment")}</div>
            <div className="relative text-13 text-white/50">
              {formatNumber(stats.jobs)} {L("yeni iş yeri", "new jobs")} · {stats.total} {L("müraciət", "applications")}
            </div>
          </div>
        </StaggerItem>
        <StaggerItem className="h-full">
          <Kpi icon={ScanSearch} label={L("Baxılır", "Under review")} value={stats.review} hint={L("Qəbul edilib və ya mütəxəssisdədir", "Received or with a specialist")} />
        </StaggerItem>
        <StaggerItem className="h-full">
          <Kpi
            icon={CircleAlert}
            label={L("Əlavə məlumat", "More information")}
            value={stats.info}
            hint={stats.info ? L("Cavabınızı gözləyir", "Awaiting your reply") : L("Tələb yoxdur", "Nothing requested")}
            tone={stats.info ? "warn" : "default"}
            href={infoApp ? `/cabinet/applications/${infoApp.id}` : undefined}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <Kpi icon={BadgeCheck} label={L("Qalib", "Won")} value={stats.won} hint={L("Müsabiqədə qalib olduğunuz sahələr", "Plots you have won")} tone="lime" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="p-2">
          <div className="flex items-center justify-between px-3 pb-2 pt-3">
            <h2 className="text-lg">{L("Müraciətlərim", "My applications")}</h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-13 font-semibold text-ink-2 tabular">{stats.total}</span>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !apps?.length ? (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-primary-50 text-primary">
                <FileText className="size-6" aria-hidden />
              </span>
              <p className="mt-3 text-sm text-ink-2">{L("Hələ müraciətiniz yoxdur. Xəritədə və ya kataloqda uyğun sahəni seçib müraciət edin.", "No applications yet. Pick a plot on the map or in the catalogue and apply.")}</p>
              <Button asChild className="mt-4">
                <Link href="/map">{L("Sahə seç", "Pick a plot")}</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {apps.map((a, i) => (
                <ApplicationRow key={a.id} a={a} index={i} />
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          {infoApp && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
              className="relative overflow-hidden rounded-3xl bg-status-info-fg p-5 text-white"
            >
              <span className="absolute right-4 top-4 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-white" />
              </span>
              <CircleAlert className="size-6" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold text-white">{L("Mütəxəssis əlavə məlumat istəyir", "The specialist needs more information")}</h3>
              <p className="mt-1 text-13 text-white/80">
                {infoApp.number} · {infoApp.area_name}. {L("Cavab verdikdən sonra müraciət yenidən baxılmaya qayıdır.", "Once you reply, the application returns to review.")}
              </p>
              <Button asChild variant="secondary" size="sm" className="mt-4 border-transparent">
                <Link href={`/cabinet/applications/${infoApp.id}`}>
                  {L("Cavab ver", "Reply")} <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          )}

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-15">{L("Yaxınlaşan son tarixlər", "Upcoming deadlines")}</h2>
              <Clock className="size-4 text-ink-3" aria-hidden />
            </div>
            <ul className="mt-3 space-y-3">
              {deadlines.map((c) => {
                const total = new Date(c.deadline_at).getTime() - new Date(c.opens_at).getTime();
                const pct = Math.min(100, Math.max(0, ((Date.now() - new Date(c.opens_at).getTime()) / Math.max(1, total)) * 100));
                const days = Math.max(0, daysUntil(c.deadline_at));
                return (
                  <li key={c.id}>
                    <Link href={`/competitions/${c.number}`} className="group flex items-center gap-3 rounded-2xl p-1 transition-colors hover:bg-surface-2">
                      <span className="relative">
                        <DeadlineRing pct={pct} />
                        <span className="absolute inset-0 flex items-center justify-center text-13 font-bold tabular">{days}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-2xs text-ink-3">{c.number}</span>
                        <span className="block truncate text-13 font-medium">{c.title_az}</span>
                        <span className="block text-2xs text-ink-3">{L(`${days} gün qalıb`, `${days} days left`)} · {formatDate(c.deadline_at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {comps && deadlines.length === 0 && <li className="text-13 text-ink-3">{L("Hazırda açıq müsabiqə yoxdur.", "No open competitions right now.")}</li>}
            </ul>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-15">{L("Son bildirişlər", "Latest notifications")}</h2>
              <Link href="/cabinet/notifications" className="text-13 font-semibold text-primary hover:underline">
                {L("Hamısı", "All")}
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {(notes?.items ?? []).slice(0, 3).map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", n.read_at ? "bg-surface-2 text-ink-3" : "bg-accent text-ink")}>
                    <Bell className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-13 font-medium">{n.title_az}</span>
                    <span className="block text-2xs text-ink-3">{formatDateTime(n.created_at)}</span>
                  </span>
                </li>
              ))}
              {notes && notes.items.length === 0 && <li className="text-13 text-ink-3">{L("Bildiriş yoxdur.", "No notifications.")}</li>}
            </ul>
          </Panel>
        </div>
      </div>

      {recommended.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-accent-text" aria-hidden /> {L("Sizə uyğun sahələr", "Plots for you")}
              </h2>
              <p className="text-13 text-ink-3">{L("Açıq müsabiqədə, uyğunluq sinfi S1–S2 olan və hələ müraciət etmədiyiniz sahələr.", "In an open competition, suitability class S1–S2, and not applied for yet.")}</p>
            </div>
            <Link href="/map?open=1" className="group inline-flex items-center gap-1.5 text-13 font-semibold text-primary">
              {L("Xəritədə hamısı", "All on the map")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <Stagger inView step={0.08} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recommended.map((a) => (
              <StaggerItem key={a.code} className="h-full">
                <RecommendedArea area={a} geometry={geometries.get(a.code)} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}
