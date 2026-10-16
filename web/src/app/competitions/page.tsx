"use client";

import { ArrowUpRight, CalendarClock, LandPlot } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { EASE, Stagger, StaggerItem } from "@/components/ui/motion";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/panel";
import { useCompetitions } from "@/features/areas/api";
import { useL } from "@/lib/i18n";
import { daysUntil, formatDate, formatHectares } from "@/lib/utils";

export default function CompetitionsPage() {
  const L = useL();
  const { data, isLoading } = useCompetitions();
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <PageHeader
        eyebrow={L("Müsabiqələr", "Competitions")}
        title={L("Elan olunmuş müsabiqələr", "Announced competitions")}
        description={L("Nazirlik tərəfindən təsdiq edilib elan olunmuş investisiya müsabiqələri. Hər müsabiqə bir neçə lotdan (sahədən) ibarətdir.", "Investment competitions approved and announced by the Ministry. Each competition has several lots (plots).")}
      />
      <Stagger step={0.08} delay={0.1} className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
        {data?.map((c) => {
          const total = new Date(c.deadline_at).getTime() - new Date(c.opens_at).getTime();
          const pct = Math.min(100, Math.max(0, ((Date.now() - new Date(c.opens_at).getTime()) / Math.max(1, total)) * 100));
          const days = daysUntil(c.deadline_at);
          return (
            <StaggerItem key={c.id} className="h-full">
              <Link
                href={`/competitions/${c.number}`}
                className="group flex h-full flex-col rounded-3xl border border-border/70 bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-float"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary-50 px-3 py-1 font-mono text-13 font-semibold text-primary">{c.number}</span>
                  <CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} />
                </div>
                <h2 className="mt-4 text-xl leading-snug">{c.title_az}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-ink-2">{c.description_az}</p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-13">
                  <div className="rounded-2xl bg-surface-2 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-ink-3">
                      <LandPlot className="size-3.5" aria-hidden /> {L("Lotlar", "Lots")}
                    </div>
                    <div className="mt-0.5 font-semibold tabular">
                      {c.area_count} {L("sahə", "plots")} · {formatHectares(Number(c.total_ha))}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-surface-2 px-3 py-2">
                    <div className="flex items-center gap-1.5 text-ink-3">
                      <CalendarClock className="size-3.5" aria-hidden /> {L("Son müraciət", "Deadline")}
                    </div>
                    <div className="mt-0.5 font-semibold tabular">{formatDate(c.deadline_at)}</div>
                  </div>
                </div>
                <div className="mt-auto pt-5">
                  <div className="flex items-baseline justify-between text-13">
                    <span className="text-ink-3">{L("Qəbul müddəti", "Application window")}</span>
                    <span className="font-semibold tabular">{days > 0 ? L(`${days} gün qalıb`, `${days} days left`) : L("Müddət bitib", "Closed")}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent-strong"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: EASE, delay: 0.3 }}
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <span className="inline-flex items-center gap-2 text-13 font-semibold text-primary">
                      {L("Lotlara bax", "View lots")}
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-accent transition-transform duration-300 ease-spring group-hover:rotate-45">
                        <ArrowUpRight className="size-4" />
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
