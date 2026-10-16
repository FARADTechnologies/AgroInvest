"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  FileCheck2,
  GitCompareArrows,
  MapPinned,
  Menu,
  ShieldCheck,
  Sprout,
  X
} from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { PURPOSE_HEX, PURPOSE_META } from "@/components/domain/purpose-chip";
import { Brand } from "@/components/layout/brand";
import { AnimatedNumber, EASE, Stagger, StaggerItem } from "@/components/ui/motion";
import { Accent } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/panel";
import { useAreas, useCompetitions, usePublicStats } from "@/features/areas/api";
import type { AreaFilters } from "@/features/areas/filters";
import { isStaff, useSession } from "@/features/auth/use-session";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { HERO_FIELDS, SATELLITE_ATTRIBUTION, satelliteStill } from "@/lib/imagery";
import { useL, useT } from "@/lib/i18n";
import { LanguageSwitch } from "@/components/layout/app-shell";
import { cn, daysUntil, formatDate, formatHectares } from "@/lib/utils";

const ALL_AREAS: AreaFilters = {
  purposes: [], region: "", rayonId: null, minHa: null, maxHa: null, openOnly: false, q: "", sort: "deadline",
  feeMin: null, feeMax: null, invMin: null, invMax: null
};

const NAV = [
  { href: "/map", label: "Xəritə", en: "Map" },
  { href: "/catalogue", label: "Kataloq", en: "Catalogue" },
  { href: "/competitions", label: "Müsabiqələr", en: "Competitions" },
  { href: "#necə-işləyir", label: "Necə işləyir", en: "How it works" }
];

const PURPOSE_IMAGE: Record<Purpose, string> = {
  CROP: satelliteStill([47.06, 39.96, 47.12, 40.0], 720, 540),
  ORCHARD: satelliteStill([47.02, 40.3, 47.08, 40.345], 720, 540),
  LIVESTOCK: satelliteStill([46.02, 40.06, 46.1, 40.12], 720, 540),
  OTHER: satelliteStill([46.9, 39.97, 46.96, 40.015], 720, 540)
};

const PURPOSE_COPY_EN: Record<Purpose, string> = {
  CROP: "Irrigated lowland fields for grain, industrial and fodder crops.",
  ORCHARD: "Perennial plots for fruit orchards and vineyards.",
  LIVESTOCK: "Mountain pastures for livestock farms.",
  OTHER: "Plots for greenhouses and primary processing."
};

const PURPOSE_COPY: Record<Purpose, string> = {
  CROP: "Taxıl, texniki və yem bitkiləri üçün suvarılan düzən sahələr.",
  ORCHARD: "Meyvə bağları və üzümlüklər üçün çoxillik əkmə sahələri.",
  LIVESTOCK: "Dağ otlaqları və heyvandarlıq təsərrüfatları üçün yaylaqlar.",
  OTHER: "İstixana və ilkin emal müəssisələri üçün sahələr."
};

const STEPS = [
  { icon: MapPinned, title: "Sahəni seçin", text: "Peyk xəritəsində təyinat, ölçü, suvarma və uyğunluq balına görə süzün.", enTitle: "Pick a plot", enText: "Filter the satellite map by purpose, size, irrigation and suitability score." },
  { icon: GitCompareArrows, title: "Müqayisə edin", text: "Üç sahəni yan-yana qoyun: icarə haqqı, minimum investisiya, məsafələr.", enTitle: "Compare", enText: "Put three plots side by side: lease fee, minimum investment, distances." },
  { icon: FileCheck2, title: "Onlayn müraciət edin", text: "Biznes planı və sənədləri yükləyin, müraciət nömrəsini dərhal alın.", enTitle: "Apply online", enText: "Upload your business plan and documents and get an application number at once." },
  { icon: BadgeCheck, title: "Statusu izləyin", text: "Hər mərhələ, səbəb və qərar kabinetdə; dəyişiklikdə bildiriş gəlir.", enTitle: "Track the status", enText: "Every step, reason and decision in your account, with a notification on each change." }
];

function LandingHeader() {
  const L = useL();
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: user } = useSession();
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));
  const home = user ? (isStaff(user) ? "/admin/applications" : "/cabinet") : "/login";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className={cn(
          "mx-auto flex h-16 max-w-7xl items-center gap-6 rounded-full pl-4 pr-2 transition-all duration-500",
          solid ? "glass" : "border border-white/15 bg-white/10 backdrop-blur-md"
        )}
      >
        <Brand light={!solid} />
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label={L("Əsas menyu", "Main menu")}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                solid ? "text-ink-2 hover:bg-surface-2 hover:text-ink" : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              {L(n.label, n.en)}
            </Link>
          ))}
        </nav>
        <LanguageSwitch dark={!solid} className="ml-auto hidden sm:flex lg:ml-2" />
        <Link
          href={home}
          className="group ml-auto flex h-12 items-center gap-2 rounded-full bg-white pl-5 pr-1.5 sm:ml-0 text-sm font-semibold text-ink shadow-card transition hover:shadow-float lg:ml-2"
        >
          {user ? L("Kabinet", "Account") : L("Daxil ol", "Sign in")}
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-accent transition-transform duration-300 ease-spring group-hover:rotate-45">
            <ArrowUpRight className="size-4" />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn("rounded-full p-2.5 lg:hidden", solid ? "text-ink" : "text-white")}
          aria-label="Menyu"
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </motion.div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass mx-auto mt-2 max-w-7xl rounded-3xl p-2 lg:hidden"
          >
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-medium text-ink hover:bg-white">
                {L(n.label, n.en)}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const L = useL();
  const { data: stats } = usePublicStats();
  const { data: comps } = useCompetitions();
  const open = comps?.find((c) => c.is_open);

  return (
    <section ref={ref} className="relative p-2 sm:p-3">
      <div className="relative min-h-[100svh] overflow-hidden rounded-[32px] bg-[radial-gradient(120%_80%_at_20%_10%,#2C5A3C_0%,#13432F_45%,#0A2418_100%)] sm:min-h-[calc(100svh-24px)]">
        {/* Satellite still of the Mil plain, drifting slowly. */}
        <motion.div style={{ y }} className="absolute inset-0">
          <img
            src={HERO_FIELDS}
            alt=""
            className="animate-kenburns size-full object-cover opacity-90"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(8_28_18/0.88)_0%,rgb(8_28_18/0.55)_45%,rgb(8_28_18/0.1)_75%)]" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[rgb(8_28_18/0.7)] to-transparent" aria-hidden />

        <motion.div style={{ opacity: fade }} className="relative mx-auto flex min-h-[inherit] max-w-7xl flex-col justify-center px-6 pb-40 pt-32 sm:px-10">
          <Stagger step={0.09} delay={0.2} className="max-w-3xl">
            <StaggerItem>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-13 font-medium text-white/90 backdrop-blur-md">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-accent" />
                </span>
                {L("Qarabağ və Şərqi Zəngəzur · investisiya müsabiqələri", "Karabakh and East Zangezur · investment competitions")}
              </span>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-6 text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] text-white sm:text-[68px] lg:text-[84px]">
                {L("Torpağa investisiya,", "Invest in the land,")}
                <br />
                {L("", "harvest the ")}
                <Accent className="text-accent">{L("gələcəyə", "future")}</Accent>
                {L(" məhsul.", ".")}
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                {L(
                  "İşğaldan azad edilmiş ərazilərdə kənd təsərrüfatı sahələrini peyk xəritəsində tapın, müqayisə edin və müsabiqəyə onlayn müraciət edin — qərara qədər hər addım şəffafdır.",
                  "Find farmland in the liberated territories on a satellite map, compare plots and apply to competitions online — every step to the decision is transparent."
                )}
              </p>
            </StaggerItem>
            <StaggerItem className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/map"
                className="group flex h-14 items-center gap-3 rounded-full bg-accent pl-6 pr-2 text-15 font-semibold text-ink transition hover:bg-accent-strong"
              >
                {L("Xəritəni aç", "Open the map")}
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-accent transition-transform duration-300 ease-spring group-hover:rotate-45">
                  <ArrowUpRight className="size-5" />
                </span>
              </Link>
              <Link
                href="/competitions"
                className="group flex h-14 items-center gap-3 rounded-full bg-white pl-6 pr-2 text-15 font-semibold text-ink transition hover:shadow-float"
              >
                {L("Müsabiqələr", "Competitions")}
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-primary transition-transform duration-300 ease-spring group-hover:rotate-45">
                  <ArrowUpRight className="size-5" />
                </span>
              </Link>
            </StaggerItem>
          </Stagger>
        </motion.div>

        {/* Live figures from the portal. */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.7 }}
          // The row spans the hero's width; only the card takes clicks, so it never covers the buttons above.
          className="pointer-events-none absolute inset-x-6 bottom-6 flex flex-wrap items-end justify-between gap-4 sm:inset-x-10 sm:bottom-10"
        >
          <dl className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: L("Açıq müsabiqə", "Open competitions"), value: stats?.competitions_open },
              { label: L("Təklif olunan sahə", "Plots offered"), value: stats?.areas_offered },
              { label: L("Hektar", "Hectares"), value: stats ? Number(stats.hectares_offered) : undefined }
            ].map((s) => (
              <div key={s.label} className="rounded-3xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
                <dd className="text-2xl font-semibold text-white sm:text-4xl">
                  {s.value === undefined ? "—" : <AnimatedNumber value={s.value} />}
                </dd>
                <dt className="mt-0.5 text-2xs font-medium uppercase tracking-[0.12em] text-white/60 sm:text-13 sm:normal-case sm:tracking-normal">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>

          {open && (
            <Link
              href={`/competitions/${open.number}`}
              className="glass group pointer-events-auto hidden w-[340px] rounded-3xl p-3 transition hover:-translate-y-1 md:block"
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="font-mono text-13 font-semibold text-ink">{open.number}</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-accent transition-transform duration-300 ease-spring group-hover:rotate-45">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <div className="relative h-32 overflow-hidden rounded-2xl bg-primary">
                <img src={PURPOSE_IMAGE.CROP} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-2xs font-bold text-ink">
                  {L(`${Math.max(0, daysUntil(open.deadline_at))} gün qalıb`, `${Math.max(0, daysUntil(open.deadline_at))} days left`)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 px-1 text-13 font-medium text-ink">{open.title_az}</p>
              <p className="px-1 text-2xs text-ink-3">
                {open.area_count} {L("sahə", "plots")} · {formatHectares(Number(open.total_ha))}
              </p>
            </Link>
          )}
        </motion.div>
        <span className="absolute bottom-2 right-4 text-[10px] text-white/40">{SATELLITE_ATTRIBUTION}</span>
      </div>
    </section>
  );
}

function TrustStrip() {
  const L = useL();
  const items = [
    L("OpenStreetMap sahə poliqonları", "OpenStreetMap field polygons"),
    L("FAO uyğunluq sinifləri", "FAO suitability classes"),
    L("EKTİS inteqrasiyasına hazır", "Ready for EKTIS integration"),
    L("Minatəmizləmə statusu", "Demining status"),
    L("Bakı vaxtı ilə son tarixlər", "Deadlines in Baku time")
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 text-center sm:px-10">
      <p className="text-sm font-semibold text-primary">{L("Şəffaf məlumat, ölçülə bilən qərarlar", "Open data, measurable decisions")}</p>
      <div className="relative mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
        <motion.div
          className="flex w-max gap-10"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, ease: "linear", repeat: Infinity }}
        >
          {[...items, ...items].map((t, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap text-15 font-medium text-ink-3">
              <Sprout className="size-4 text-accent-text" aria-hidden /> {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Purposes() {
  const t = useT();
  const L = useL();
  const { data } = useAreas(ALL_AREAS, 1, 1);
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="max-w-xl text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl"
        >
          {L("Hər torpağın öz", "Every plot has its")} <Accent className="text-primary">{L("təyinatı", "purpose")}</Accent>{L(" var.", ".")}
        </motion.h2>
        <p className="max-w-sm text-ink-2">
          {L("Sahələr təyinata görə qruplaşdırılıb. Kateqoriyanı seçin, xəritədə həmin sahələr və bitki növləri açılsın.", "Plots are grouped by purpose. Pick a category to open its plots and crop types on the map.")}
        </p>
      </div>
      <Stagger inView step={0.1} className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PURPOSES.map((p) => {
          const Icon = PURPOSE_META[p].icon;
          return (
            <StaggerItem key={p}>
              <Link
                href={`/map?purpose=${p}`}
                className="group relative flex h-[380px] flex-col justify-end overflow-hidden rounded-[28px] bg-primary p-5 text-white shadow-card"
              >
                <img
                  src={PURPOSE_IMAGE[p]}
                  alt=""
                  className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-110"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <span className="absolute inset-0 bg-gradient-to-t from-[rgb(8_28_18/0.92)] via-[rgb(8_28_18/0.35)] to-transparent" aria-hidden />
                <span
                  className="absolute left-5 top-5 flex size-12 items-center justify-center rounded-2xl backdrop-blur-md"
                  style={{ background: `${PURPOSE_HEX[p]}cc` }}
                >
                  <Icon className="size-6 text-white" aria-hidden />
                </span>
                <span className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-all duration-300 ease-spring group-hover:rotate-45 group-hover:bg-accent group-hover:text-ink">
                  <ArrowUpRight className="size-5" />
                </span>
                <div className="relative">
                  <div className="text-4xl font-semibold tabular">
                    {data ? <AnimatedNumber value={data.purpose_counts[p] ?? 0} /> : "—"}
                    <span className="ml-1.5 text-base font-medium text-white/60">{L("sahə", "plots")}</span>
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold text-white">{t.purpose[p]}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-white/70">{L(PURPOSE_COPY[p], PURPOSE_COPY_EN[p])}</p>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}

function HowItWorks() {
  const L = useL();
  return (
    <section id="necə-işləyir" className="scroll-mt-28 px-2 sm:px-3">
      <div className="mx-auto max-w-[1400px] rounded-[32px] bg-side px-6 py-20 text-white sm:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-4xl leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">
              {L("Dörd addımda", "Apply in")} <Accent className="text-accent">{L("müraciət", "four steps")}</Accent>.
            </h2>
            <p className="max-w-sm text-white/60">{L("Kağız yoxdur, növbə yoxdur. Qaralama avtomatik saxlanılır, istədiyiniz vaxt davam edin.", "No paper, no queues. Drafts save automatically, so you can continue any time.")}</p>
          </div>
          <div className="relative mt-14">
            <motion.span
              className="absolute left-0 right-0 top-7 hidden h-px origin-left bg-gradient-to-r from-accent via-accent/50 to-transparent lg:block"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: EASE }}
              aria-hidden
            />
            <Stagger inView step={0.15} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text, enTitle, enText }, i) => (
                <StaggerItem key={title} className="relative">
                  <span className="relative flex size-14 items-center justify-center rounded-2xl bg-accent text-ink shadow-glow">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div className="mt-5 font-mono text-13 text-white/40">0{i + 1}</div>
                  <h3 className="mt-1 text-xl font-semibold text-white">{L(title, enTitle)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{L(text, enText)}</p>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </div>
    </section>
  );
}

function OpenCompetitions() {
  const L = useL();
  const { data, isLoading } = useCompetitions();
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">
          {L("Elan olunmuş", "Announced")} <Accent className="text-primary">{L("müsabiqələr", "competitions")}</Accent>
        </h2>
        <Link href="/competitions" className="group inline-flex items-center gap-2 text-sm font-semibold text-primary">
          {L("Hamısına bax", "See all")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <Stagger inView step={0.1} className="mt-10 grid gap-4 lg:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-[28px]" />)}
        {data?.slice(0, 3).map((c) => {
          const total = new Date(c.deadline_at).getTime() - new Date(c.opens_at).getTime();
          const passed = Date.now() - new Date(c.opens_at).getTime();
          const pct = Math.min(100, Math.max(0, (passed / Math.max(1, total)) * 100));
          return (
            <StaggerItem key={c.id}>
              <Link
                href={`/competitions/${c.number}`}
                className="group flex h-full flex-col rounded-[28px] border border-border/70 bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-float"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-13 font-semibold text-primary">{c.number}</span>
                  <CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} />
                </div>
                <h3 className="mt-4 text-xl leading-snug">{c.title_az}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-ink-2">{c.description_az}</p>
                <div className="mt-auto pt-6">
                  <div className="flex items-baseline justify-between text-13">
                    <span className="text-ink-3">{L("Son müraciət", "Deadline")}: {formatDate(c.deadline_at)}</span>
                    <span className="font-semibold tabular">{Math.max(0, daysUntil(c.deadline_at))} {L("gün", "days")}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent-strong"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: EASE }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-13 text-ink-2">
                    <span className="tabular">
                      {c.area_count} {L("sahə", "plots")} · {formatHectares(Number(c.total_ha))}
                    </span>
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary text-accent transition-transform duration-300 ease-spring group-hover:rotate-45">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}

function CallToAction() {
  const L = useL();
  return (
    <section className="px-2 pb-3 sm:px-3">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[32px] bg-accent px-6 py-16 sm:px-12"
      >
        <svg className="absolute -right-10 top-0 h-full w-1/2 text-primary/10" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <path key={i} d={`M0 ${20 + i * 18} C 50 ${5 + i * 18}, 100 ${35 + i * 18}, 200 ${15 + i * 18}`} stroke="currentColor" strokeWidth="6" fill="none" />
          ))}
        </svg>
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div>
            <h2 className="max-w-2xl text-4xl leading-[1.05] tracking-[-0.03em] text-ink sm:text-5xl">
              {L("Sahəniz sizi", "Your plot is")} <Accent>{L("gözləyir", "waiting")}</Accent>.
            </h2>
            <p className="mt-3 max-w-lg text-ink/70">{L("İnvestor və ya sahibkar hesabı bir dəqiqəyə açılır. Fiziki və hüquqi şəxslər qoşula bilər.", "An account takes a minute. Individuals and companies can apply.")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="group flex h-14 items-center gap-3 rounded-full bg-primary pl-6 pr-2 text-15 font-semibold text-white transition hover:bg-primary-hover"
            >
              {L("Hesab yarat", "Create account")}
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-ink transition-transform duration-300 ease-spring group-hover:rotate-45">
                <ArrowUpRight className="size-5" />
              </span>
            </Link>
            <Link href="/map" className="flex h-14 items-center rounded-full border border-ink/15 px-6 text-15 font-semibold text-ink transition hover:bg-ink/5">
              {L("Əvvəlcə xəritəyə bax", "Explore the map first")}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  const L = useL();
  return (
    <footer className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
      <div className="flex flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
        <Brand />
        <nav className="flex flex-wrap gap-5 text-sm text-ink-2" aria-label="Alt menyu">
          <Link href="/map" className="hover:text-ink">{L("Xəritə", "Map")}</Link>
          <Link href="/catalogue" className="hover:text-ink">{L("Kataloq", "Catalogue")}</Link>
          <Link href="/competitions" className="hover:text-ink">{L("Müsabiqələr", "Competitions")}</Link>
          <Link href="/privacy" className="hover:text-ink">{L("Məxfilik siyasəti", "Privacy policy")}</Link>
        </nav>
        <p className="flex items-center gap-1.5 text-13 text-ink-3">
          <ShieldCheck className="size-4" aria-hidden /> {L("Prototip · bütün məlumatlar nümayiş üçündür", "Prototype · all data is for demonstration")}
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="bg-bg">
      <LandingHeader />
      <Hero />
      <TrustStrip />
      <Purposes />
      <HowItWorks />
      <OpenCompetitions />
      <CallToAction />
      <Footer />
    </div>
  );
}
