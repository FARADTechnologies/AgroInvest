"use client";

import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";

import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useStats } from "@/features/admin/api";
import { useL } from "@/lib/i18n";
import { formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

/** Large sums read better compacted: 8,9 mln AZN. */
function compactAzn(v: number, mln = "mln"): string {
  if (v >= 1_000_000) return `${formatNumber(v / 1_000_000, 1)} ${mln} AZN`;
  return formatAzn(v);
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-surface shadow-card px-4 py-3">
      <div className="text-13 text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {note && <div className="mt-0.5 text-13 text-ink-3">{note}</div>}
    </div>
  );
}

const STATUS_ORDER = ["RECEIVED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"] as const;

export default function StatsPage() {
  const L = useL();
  const { data: s, isLoading } = useStats();

  if (isLoading || !s) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const daily = s.daily.map((d) => ({
    key: d.day,
    label: formatDate(`${d.day}T12:00:00Z`).slice(0, 5),
    value: d.applications
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] tracking-[-0.03em]">{L("Statistika və hesabatlar", "Statistics and reports")}</h1>
          <p className="text-13 text-ink-2">{L("Göstəricilər hər 30 saniyədən bir yenilənir. Hesabatda FİN və VÖEN maskalanır.", "Figures refresh every 30 seconds. Personal and tax IDs are masked in the report.")}</p>
        </div>
        <Button asChild variant="secondary">
          {/* A plain link: the browser downloads the file with the session cookie. */}
          <a href="/api/v1/admin/reports/applications.xlsx" download>
            <FileSpreadsheet /> {L("Excel hesabatı", "Excel report")}
          </a>
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={L("Əsas göstəricilər", "Key figures")}>
        <StatTile label={L("Açıq müsabiqələr", "Open competitions")} value={formatNumber(s.competitions_open)} note={L(`cəmi ${s.competitions_total}, təsdiq gözləyən ${s.competitions_pending_approval}`, `${s.competitions_total} total, ${s.competitions_pending_approval} awaiting approval`)} />
        <StatTile label={L("Müsabiqəyə çıxarılan sahələr", "Plots offered")} value={formatNumber(s.areas_offered)} note={formatHectares(Number(s.hectares_offered))} />
        <StatTile label={L("Müraciətlər", "Applications")} value={formatNumber(s.applications_total)} note={L(`Qalib ${s.decided_won} · İmtina ${s.decided_rejected}`, `Won ${s.decided_won} · Rejected ${s.decided_rejected}`)} />
        <StatTile label={L("Planlaşdırılan investisiya", "Planned investment")} value={compactAzn(Number(s.planned_investment_azn), L("mln", "m"))} note={L("göndərilmiş müraciətlər üzrə", "across submitted applications")} />
        <StatTile label={L("Planlaşdırılan iş yerləri", "Planned jobs")} value={formatNumber(s.planned_jobs)} />
        <StatTile label={L("Yerli sahibkarların payı", "Local applicants")} value={`${formatNumber(s.local_applicant_share * 100)}%`} note={L("müraciət edənlər arasında", "share of all applicants")} />
        <StatTile
          label={L("Qərara qədər orta müddət", "Average time to decision")}
          value={s.avg_decision_days != null ? `${formatNumber(s.avg_decision_days, 1)} ${L("gün", "days")}` : "—"}
          note={L("göndərilmədən qərara qədər", "from submission to decision")}
        />
        <StatTile label={L("Bölüşdürülmüş sahələr", "Allocated plots")} value={formatNumber(s.areas_allocated)} note={L("qalib müəyyən edilib", "winner chosen")} />
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
            <PanelTitle>{L("Son 30 gündə daxil olan müraciətlər", "Applications in the last 30 days")}</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ColumnChart data={daily} title={L("Son 30 gündə gündəlik müraciət sayı", "Daily applications, last 30 days")} unit={L("müraciət", "applications")} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>
            <PanelTitle>{L("Rayonlar üzrə", "By district")}</PanelTitle>
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
                extra: [formatNumber(r.areas), formatHectares(Number(r.hectares)), compactAzn(Number(r.investment_azn), L("mln", "m"))]
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
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("Müsabiqələr", "Competitions")}</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[720px] text-13">
            <thead>
              <tr className="border-b border-border/70 bg-surface-2/60 text-left text-ink-3">
                <th className="px-4 py-2 font-medium">{L("Nömrə", "Number")}</th>
                <th className="px-4 py-2 font-medium">{L("Ad", "Title")}</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">{L("Lotlar", "Lots")}</th>
                <th className="px-4 py-2 text-right font-medium">{L("Müraciətlər", "Applications")}</th>
                <th className="px-4 py-2 font-medium">{L("Son tarix", "Deadline")}</th>
              </tr>
            </thead>
            <tbody className="tabular [&_td]:whitespace-nowrap">
              {s.by_competition.map((c) => (
                <tr key={c.number} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 font-mono">{c.number}</td>
                  <td className="max-w-[360px] truncate px-4 py-2" title={c.title_az}>{c.title_az}</td>
                  <td className="px-4 py-2"><CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} /></td>
                  <td className="px-4 py-2 text-right">{c.lots}</td>
                  <td className="px-4 py-2 text-right">{c.applications}</td>
                  <td className="px-4 py-2 text-ink-2">{formatDate(c.deadline_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="text-13 text-ink-3">
        {L("Ümumi göstəricilərin şəxsi məlumatsız versiyası şəffaflıq üçün açıq API ilə də verilir", "An anonymised version of these figures is also published through an open API for transparency")} (<Link href="/api/v1/stats/public" className="font-mono hover:underline">/api/v1/stats/public</Link>).
      </p>
    </div>
  );
}
