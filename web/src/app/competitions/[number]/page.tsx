"use client";

import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useCompetition } from "@/features/areas/api";
import { formatAzn, formatDateTime, formatHectares } from "@/lib/utils";

export default function CompetitionDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const { data: c, isLoading, error } = useCompetition(number);

  if (error) return <div className="px-6 py-16 text-center text-ink-2">Müsabiqə tapılmadı.</div>;
  if (isLoading || !c) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/competitions" className="hover:text-ink">Müsabiqələr</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{c.number}</span>
      </nav>
      <header className="mt-3">
        <div className="font-mono text-sm text-ink-3">{c.number}</div>
        <h1 className="text-2xl">{c.title_az}</h1>
        <p className="mt-2 max-w-3xl text-ink-2">{c.description_az}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-13 text-ink-2">
          <span>Son müraciət: <span className="font-medium text-ink">{formatDateTime(c.deadline_at)}</span> (Bakı vaxtı)</span>
          <DeadlineBadge iso={c.deadline_at} />
          <span className="tabular">{c.area_count} sahə · {formatHectares(Number(c.total_ha))}</span>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <PanelHeader>
            <PanelTitle>Lotlar</PanelTitle>
          </PanelHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-13 text-ink-2">
                  <th className="px-4 py-2 font-medium">Lot</th>
                  <th className="px-4 py-2 font-medium">Sahə</th>
                  <th className="px-4 py-2 font-medium">Təyinat</th>
                  <th className="px-4 py-2 text-right font-medium">Ölçü</th>
                  <th className="px-4 py-2 text-right font-medium">Min. investisiya</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {c.lots.map((lot) => (
                  <tr key={lot.code} className="border-b border-border last:border-b-0 hover:bg-surface-2/60">
                    <td className="px-4 py-2.5 text-ink-2">{lot.lot_no}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/areas/${lot.code}`} className="font-mono text-13 font-medium text-primary hover:underline">
                        {lot.code}
                      </Link>
                      <div className="text-13 text-ink-2">{lot.rayon_name}</div>
                    </td>
                    <td className="px-4 py-2.5"><PurposeChip purpose={lot.purpose} /></td>
                    <td className="px-4 py-2.5 text-right">{formatHectares(Number(lot.area_ha))}</td>
                    <td className="px-4 py-2.5 text-right">
                      {lot.min_investment_azn ? formatAzn(Number(lot.min_investment_azn)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>Müsabiqənin şərtləri</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="text-sm leading-relaxed">{c.conditions_az}</p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>Tələb olunan sənədlər</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-border">
              {c.required_documents.map((d) => (
                <li key={d.code} className="flex gap-2.5 px-4 py-2.5 text-sm">
                  <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  <span>
                    {d.name_az}
                    {!d.mandatory && <span className="text-ink-3"> (könüllü)</span>}
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
