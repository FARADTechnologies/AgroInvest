"use client";

import { StatusBadge } from "@/components/domain/status-badge";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useListingApplications } from "@/features/listings/api";
import { useT } from "@/lib/i18n";
import { formatAzn, formatDate } from "@/lib/utils";

export default function ListingApplicationsPage() {
  const t = useT();
  const { data: rows, isLoading } = useListingApplications();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">Elanlarıma müraciətlər</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          İnvestorların elanlarınıza göndərdiyi müraciətlər. Müraciətlərə müsabiqə komissiyası baxır; status dəyişdikcə burada
          görünür.
        </p>
      </div>
      <Panel className="overflow-x-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : !rows?.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">Elanlarınıza hələ müraciət daxil olmayıb.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-13 text-ink-3">
                <th className="px-3 py-2 font-medium">Müraciət</th>
                <th className="px-3 py-2 font-medium">İnvestor</th>
                <th className="px-3 py-2 font-medium">Sahə</th>
                <th className="px-3 py-2 text-right font-medium">İnvestisiya</th>
                <th className="px-3 py-2 text-right font-medium">İş yeri</th>
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
