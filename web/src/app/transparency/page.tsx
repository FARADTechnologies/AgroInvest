"use client";

import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import Link from "next/link";

import { BarList } from "@/components/charts/bar-list";
import { compactAzn, StatTile } from "@/components/charts/stat-tile";
import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { api, unwrap } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { formatDate, formatHectares, formatNumber } from "@/lib/utils";

const STATUS_ORDER = ["RECEIVED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"] as const;

/**
 * Public transparency page (PDF §1, "making administrative processes transparent"):
 * aggregate figures about competitions, applications and decisions. No names or
 * identifiers ever reach this page; the API returns aggregates only.
 */
export default function TransparencyPage() {
  const L = useL();
  const { data: s } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => unwrap(api.GET("/api/v1/stats/public")),
    refetchInterval: 60_000
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">{L("Şəffaflıq", "Transparency")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            {L(
              "Müsabiqələr, müraciətlər və qərarlar üzrə ümumiləşdirilmiş göstəricilər. Fərdi məlumat dərc edilmir; hər müraciətçi öz müraciətinin tarixçəsini və qərarın səbəbini şəxsi kabinetdə görür.",
              "Aggregate figures on competitions, applications and decisions. No personal data is published; each applicant sees the history of their own application and the reason for the decision in their cabinet."
            )}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-13 text-ink-3" title={L("Prototipdə göstəricilər nümayiş məlumatlarından hesablanır", "In the prototype the figures are computed from demo data")}>
          <Info className="size-3.5" aria-hidden /> {L("Demo məlumatı", "Demo data")}
        </span>
      </div>

      {!s ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={L("Əsas göstəricilər", "Key figures")}>
            <StatTile label={L("Qəbulu açıq müsabiqələr", "Competitions open")} value={formatNumber(s.competitions_open)} />
            <StatTile
              label={L("Müsabiqəyə çıxarılan sahələr", "Plots offered")}
              value={formatNumber(s.areas_offered)}
              note={formatHectares(Number(s.hectares_offered))}
            />
            <StatTile label={L("Daxil olan müraciətlər", "Applications received")} value={formatNumber(s.applications_total)} />
            <StatTile
              label={L("Verilmiş qərarlar", "Decisions made")}
              value={formatNumber(s.decisions)}
              note={`${L("Qalib", "Won")} ${s.decided_won} · ${L("İmtina", "Rejected")} ${s.decided_rejected}`}
            />
            <StatTile label={L("Bölüşdürülmüş sahələr", "Plots allocated")} value={formatNumber(s.areas_allocated)} />
            <StatTile label={L("Planlaşdırılan investisiya", "Planned investment")} value={compactAzn(Number(s.planned_investment_azn))} />
            <StatTile label={L("Planlaşdırılan iş yerləri", "Planned jobs")} value={formatNumber(s.planned_jobs)} />
            <StatTile
              label={L("Yerli müraciətçilərin payı", "Share of local applicants")}
              value={`${formatNumber(s.local_applicant_share * 100)}%`}
              note={s.avg_decision_days != null ? `${L("Qərara qədər orta müddət", "Average time to decision")}: ${formatNumber(s.avg_decision_days, 1)} ${L("gün", "days")}` : undefined}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>{L("Müraciətlər statuslar üzrə", "Applications by status")}</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel={L("Müraciət sayı", "Applications")}
                  items={STATUS_ORDER.map((st) => ({
                    key: st,
                    name: st,
                    label: <StatusBadge status={st} />,
                    value: s.applications_by_status[st] ?? 0
                  }))}
                />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>{L("Təyinat üzrə", "By purpose")}</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel={L("Müraciət sayı", "Applications")}
                  extraHeaders={[L("Sahələr", "Plots"), L("Ərazi", "Area")]}
                  items={s.by_purpose.map((p) => ({
                    key: p.purpose,
                    name: p.purpose,
                    label: <PurposeChip purpose={p.purpose} />,
                    value: p.applications,
                    extra: [formatNumber(p.areas), formatHectares(Number(p.hectares))]
                  }))}
                />
              </PanelBody>
            </Panel>
            <Panel className="xl:col-span-2">
              <PanelHeader>
                <PanelTitle>{L("Rayonlar üzrə", "By rayon")}</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel={L("Müraciət sayı", "Applications")}
                  extraHeaders={[L("Sahələr", "Plots"), L("Ərazi", "Area"), L("İnvestisiya", "Investment")]}
                  items={s.by_rayon.map((r) => ({
                    key: r.rayon,
                    name: r.rayon,
                    label: <span className="text-ink">{r.rayon}</span>,
                    value: r.applications,
                    extra: [formatNumber(r.areas), formatHectares(Number(r.hectares)), compactAzn(Number(r.investment_azn))]
                  }))}
                />
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Müsabiqələr", "Competitions")}</PanelTitle>
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-13">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                    <th className="px-4 py-2 font-medium">{L("Nömrə", "Number")}</th>
                    <th className="px-4 py-2 font-medium">{L("Ad", "Title")}</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">{L("Lotlar", "Lots")}</th>
                    <th className="px-4 py-2 text-right font-medium">{L("Müraciətlər", "Applications")}</th>
                    <th className="px-4 py-2 font-medium">{L("Son tarix", "Deadline")}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {s.competitions.map((c) => (
                    <tr key={c.number} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2">
                        <Link href={`/competitions/${c.number}`} className="font-mono font-medium text-primary hover:underline">
                          {c.number}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{c.title_az}</td>
                      <td className="px-4 py-2">
                        <CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} />
                      </td>
                      <td className="px-4 py-2 text-right">{c.lots}</td>
                      <td className="px-4 py-2 text-right">{c.applications}</td>
                      <td className="px-4 py-2 text-ink-2">{formatDate(c.deadline_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
