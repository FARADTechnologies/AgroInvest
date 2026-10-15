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
import { formatDate, formatHectares, formatNumber } from "@/lib/utils";

const STATUS_ORDER = ["RECEIVED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"] as const;

/**
 * Public transparency page (PDF §1, "making administrative processes transparent"):
 * aggregate figures about competitions, applications and decisions. No names or
 * identifiers ever reach this page; the API returns aggregates only.
 */
export default function TransparencyPage() {
  const { data: s } = useQuery({
    queryKey: ["public-stats"],
    queryFn: () => unwrap(api.GET("/api/v1/stats/public")),
    refetchInterval: 60_000
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Şəffaflıq</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">
            Müsabiqələr, müraciətlər və qərarlar üzrə ümumiləşdirilmiş göstəricilər. Fərdi məlumat dərc edilmir; hər
            müraciətçi öz müraciətinin tarixçəsini və qərarın səbəbini şəxsi kabinetdə görür.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-13 text-ink-3" title="Prototipdə göstəricilər nümayiş məlumatlarından hesablanır">
          <Info className="size-3.5" aria-hidden /> Demo məlumatı
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
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Əsas göstəricilər">
            <StatTile label="Qəbulu açıq müsabiqələr" value={formatNumber(s.competitions_open)} />
            <StatTile
              label="Müsabiqəyə çıxarılan sahələr"
              value={formatNumber(s.areas_offered)}
              note={formatHectares(Number(s.hectares_offered))}
            />
            <StatTile label="Daxil olan müraciətlər" value={formatNumber(s.applications_total)} />
            <StatTile
              label="Verilmiş qərarlar"
              value={formatNumber(s.decisions)}
              note={`Qalib ${s.decided_won} · İmtina ${s.decided_rejected}`}
            />
            <StatTile label="Bölüşdürülmüş sahələr" value={formatNumber(s.areas_allocated)} />
            <StatTile label="Planlaşdırılan investisiya" value={compactAzn(Number(s.planned_investment_azn))} />
            <StatTile label="Planlaşdırılan iş yerləri" value={formatNumber(s.planned_jobs)} />
            <StatTile
              label="Yerli investorların payı"
              value={`${formatNumber(s.local_applicant_share * 100)}%`}
              note={s.avg_decision_days != null ? `Qərara qədər orta müddət: ${formatNumber(s.avg_decision_days, 1)} gün` : undefined}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Müraciətlər statuslar üzrə</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel="Müraciət sayı"
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
                <PanelTitle>Təyinat üzrə</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel="Müraciət sayı"
                  extraHeaders={["Sahələr", "Ərazi"]}
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
                <PanelTitle>Rayonlar üzrə</PanelTitle>
              </PanelHeader>
              <PanelBody>
                <BarList
                  valueLabel="Müraciət sayı"
                  extraHeaders={["Sahələr", "Ərazi", "İnvestisiya"]}
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
              <PanelTitle>Müsabiqələr</PanelTitle>
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-13">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                    <th className="px-4 py-2 font-medium">Nömrə</th>
                    <th className="px-4 py-2 font-medium">Ad</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium">Lotlar</th>
                    <th className="px-4 py-2 text-right font-medium">Müraciətlər</th>
                    <th className="px-4 py-2 font-medium">Son tarix</th>
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
