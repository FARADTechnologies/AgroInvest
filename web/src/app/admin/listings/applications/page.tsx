"use client";

import { StatusBadge } from "@/components/domain/status-badge";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useListingApplications } from "@/features/listings/api";
import { useL, useT } from "@/lib/i18n";
import { formatAzn, formatDate } from "@/lib/utils";


export default function ListingApplicationsPage() {
  const t = useT();
  const L = useL();
  const { data: rows, isLoading } = useListingApplications();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] tracking-[-0.03em]">{L("Elanlara müraciətlər", "Applications to listings")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {L(
            "İstifadəçilərin elanlara göndərdiyi müraciətlər. Sənədləri yoxlamaq və qərar vermək üçün müraciəti “Müraciətlər” bölməsində açın.",
            "Applications sent to listings. Open an application in Applications to check its documents and decide."
          )}
        </p>
      </div>
      <Panel className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : !rows?.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">{L("Elanlara hələ müraciət daxil olmayıb.", "No applications to listings yet.")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-13 text-ink-3">
                <th className="px-3 py-2 font-medium">{L("Müraciət", "Application")}</th>
                <th className="px-3 py-2 font-medium">{L("Müraciətçi", "Applicant")}</th>
                <th className="px-3 py-2 font-medium">{L("Sahə", "Plot")}</th>
                <th className="px-3 py-2 text-right font-medium">{L("İnvestisiya", "Investment")}</th>
                <th className="px-3 py-2 text-right font-medium">{L("İş yeri", "Jobs")}</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5">
                    <div className="font-mono font-medium">{r.number}</div>
                    <div className="text-13 text-ink-3">{r.submitted_at ? formatDate(r.submitted_at) : "—"}</div>
                  </td>
                  <td className="px-3 py-2.5">{r.investor}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono">{r.area_code}</div>
                    <div className="text-13 text-ink-3">
                      {t.purpose[r.activity]} · {r.listing_number}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{r.investment_azn ? formatAzn(Number(r.investment_azn)) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">{r.jobs_planned ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} outcome={r.outcome as "WON" | "REJECTED" | null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
