"use client";

import { ArrowUpRight, CalendarClock, ChevronRight, FileText, LandPlot, Wallet } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { use } from "react";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { AnimatedNumber, EASE } from "@/components/ui/motion";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useCompetition } from "@/features/areas/api";
import { HERO_FIELDS } from "@/lib/imagery";
import { useL } from "@/lib/i18n";
import { formatAzn, formatDateTime, formatHectares } from "@/lib/utils";

export default function CompetitionDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const L = useL();
  const { data: c, isLoading, error } = useCompetition(number);

  if (error) return <div className="px-6 py-16 text-center text-ink-2">{L("Müsabiqə tapılmadı.", "Competition not found.")}</div>;
  if (isLoading || !c) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-8 lg:px-8">
        <Skeleton className="h-56 rounded-[28px]" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const minTotal = c.lots.reduce((s, l) => s + Number(l.min_investment_azn ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/competitions" className="hover:text-ink">{L("Müsabiqələr", "Competitions")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{c.number}</span>
      </nav>

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative mt-3 overflow-hidden rounded-[28px] bg-primary p-6 text-white sm:p-8"
      >
        <img src={HERO_FIELDS} alt="" className="absolute inset-0 size-full object-cover opacity-40" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8_28_18/0.95)] via-[rgb(8_28_18/0.75)] to-[rgb(8_28_18/0.3)]" aria-hidden />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-13 font-semibold text-accent backdrop-blur">{c.number}</span>
            <CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} />
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl leading-tight text-white sm:text-4xl">{c.title_az}</h1>
          <p className="mt-3 max-w-3xl text-white/70">{c.description_az}</p>
          <dl className="mt-6 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <dt className="flex items-center gap-1.5 text-13 text-white/60">
                <LandPlot className="size-4" aria-hidden /> {L("Lotlar", "Lots")}
              </dt>
              <dd className="mt-1 text-2xl font-semibold">
                <AnimatedNumber value={c.area_count} /> <span className="text-base font-medium text-white/60">· {formatHectares(Number(c.total_ha))}</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <dt className="flex items-center gap-1.5 text-13 text-white/60">
                <CalendarClock className="size-4" aria-hidden /> {L("Son müraciət (Bakı vaxtı)", "Deadline (Baku time)")}
              </dt>
              <dd className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {formatDateTime(c.deadline_at)} <DeadlineBadge iso={c.deadline_at} className="text-accent" />
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
              <dt className="flex items-center gap-1.5 text-13 text-white/60">
                <Wallet className="size-4" aria-hidden /> {L("Minimum investisiya, cəmi", "Minimum investment, total")}
              </dt>
              <dd className="mt-1 text-2xl font-semibold">{minTotal ? formatAzn(minTotal) : "—"}</dd>
            </div>
          </dl>
        </div>
      </motion.header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="overflow-hidden">
          <PanelHeader>
            <PanelTitle>{L("Lotlar", "Lots")}</PanelTitle>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-13 font-semibold text-ink-2 tabular">{c.lots.length}</span>
          </PanelHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-13 text-ink-3">
                  <th className="px-5 py-3 font-medium">Lot</th>
                  <th className="px-5 py-3 font-medium">{L("Sahə", "Plot")}</th>
                  <th className="px-5 py-3 font-medium">{L("Təyinat", "Purpose")}</th>
                  <th className="px-5 py-3 text-right font-medium">{L("Ölçü", "Size")}</th>
                  <th className="px-5 py-3 text-right font-medium">{L("Min. investisiya", "Min. investment")}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="tabular">
                {c.lots.map((lot, i) => (
                  <motion.tr
                    key={lot.code}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: 0.1 + i * 0.03 }}
                    className="group border-t border-border/60 transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-5 py-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-13 font-semibold text-ink-2">{lot.lot_no}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/areas/${lot.code}`} className="font-mono text-13 font-semibold text-primary hover:underline">
                        {lot.code}
                      </Link>
                      <div className="text-13 text-ink-2">{lot.rayon_name}</div>
                    </td>
                    <td className="px-5 py-3"><PurposeChip purpose={lot.purpose} /></td>
                    <td className="px-5 py-3 text-right font-semibold">{formatHectares(Number(lot.area_ha))}</td>
                    <td className="px-5 py-3 text-right">{lot.min_investment_azn ? formatAzn(Number(lot.min_investment_azn)) : "—"}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/map?area=${lot.code}`}
                        title={L("Xəritədə göstər", "Show on map")}
                        className="flex size-8 items-center justify-center rounded-full text-ink-3 transition-all hover:bg-primary hover:text-accent"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Müsabiqənin şərtləri", "Conditions")}</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-sm leading-relaxed text-ink-2">{c.conditions_az}</p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Tələb olunan sənədlər", "Required documents")}</PanelTitle>
            </PanelHeader>
            <ul className="space-y-1 p-3">
              {c.required_documents.map((d) => (
                <li key={d.code} className="flex gap-3 rounded-2xl px-2 py-2 text-sm hover:bg-surface-2/60">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="self-center">
                    {d.name_az}
                    {!d.mandatory && <span className="text-ink-3"> ({L("könüllü", "optional")})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
