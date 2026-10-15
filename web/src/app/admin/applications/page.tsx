"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/panel";
import { type ApplicationStatus, useAdminApplications } from "@/features/applications/api";
import { useT } from "@/lib/i18n";
import { cn, daysUntil, formatDate, formatNumber } from "@/lib/utils";

const TABS: (ApplicationStatus | "")[] = ["", "RECEIVED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"];

function daysSince(iso: string) {
  return Math.max(0, -daysUntil(iso) + 1);
}

function ApplicationsTable() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") ?? "") as ApplicationStatus | "";
  const page = Number(params.get("page") ?? 1);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [query, setQuery] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const { data, isLoading, isFetching } = useAdminApplications({ status: status || undefined, q: query, page });
  const total = data ? Object.values(data.status_counts).reduce((a, b) => a + b, 0) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const go = (patch: Record<string, string | number | null>) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v === null || v === "" ? sp.delete(k) : sp.set(k, String(v))));
    router.replace(`/admin/applications?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl">Daxil olan müraciətlər</h1>
          <p className="text-13 text-ink-2">FİN və VÖEN siyahıda maskalanır; müraciətə hər baxış audit jurnalına yazılır.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nömrə, investor və ya sahə kodu"
            className="pl-8"
            aria-label="Müraciət axtar"
          />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {TABS.map((s) => {
          const count = s ? data?.status_counts[s] ?? 0 : total;
          const active = s === status;
          return (
            <button
              key={s || "all"}
              role="tab"
              aria-selected={active}
              onClick={() => go({ status: s, page: null })}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm",
                active ? "border-primary font-medium text-primary" : "border-transparent text-ink-2 hover:text-ink"
              )}
            >
              {s ? t.status[s] : "Hamısı"}
              <span className="rounded-sm bg-surface-2 px-1.5 text-13 tabular text-ink-2">{count}</span>
            </button>
          );
        })}
        {isFetching && <span className="ml-auto self-center text-13 text-ink-3">Yenilənir…</span>}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="condensed w-full min-w-[960px] text-13">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
              <th className="px-3 py-2 font-medium">Nömrə</th>
              <th className="px-3 py-2 font-medium">İnvestor</th>
              <th className="px-3 py-2 font-medium">FİN / VÖEN</th>
              <th className="px-3 py-2 font-medium">Sahə</th>
              <th className="px-3 py-2 font-medium">Müsabiqə</th>
              <th className="px-3 py-2 text-right font-medium">İnvestisiya, AZN</th>
              <th className="px-3 py-2 text-right font-medium">İş yeri</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Daxil olub</th>
              <th className="px-3 py-2 text-right font-medium">Statusda</th>
            </tr>
          </thead>
          <tbody className="tabular [&_td]:whitespace-nowrap">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={10} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              ))}
            {data?.items.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/admin/applications/${a.id}`)}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-primary-50/50"
              >
                <td className="px-3 py-2">
                  <Link href={`/admin/applications/${a.id}`} className="font-mono font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                    {a.number}
                  </Link>
                </td>
                <td className="max-w-[240px] truncate px-3 py-2 text-ink" title={a.applicant_name ?? ""}>{a.applicant_name}</td>
                <td className="px-3 py-2 font-mono text-ink-2">{a.applicant_identifier}</td>
                <td className="px-3 py-2">
                  <span className="font-mono">{a.area_code}</span>
                  <span className="block text-2xs text-ink-3">{a.rayon_name}</span>
                </td>
                <td className="px-3 py-2 font-mono text-ink-2">{a.competition_number}</td>
                <td className="px-3 py-2 text-right">{a.investment_azn ? formatNumber(Number(a.investment_azn)) : "—"}</td>
                <td className="px-3 py-2 text-right">{a.jobs_planned ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={a.status} outcome={a.outcome} />
                </td>
                <td className="px-3 py-2 text-ink-2">{a.submitted_at ? formatDate(a.submitted_at) : "—"}</td>
                <td className="px-3 py-2 text-right text-ink-2">{daysSince(a.last_status_at)} gün</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-ink-2">
                  Müraciət tapılmadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-end gap-2 text-13">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
            <ChevronLeft />
          </Button>
          <span className="tabular text-ink-2">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsTable />
    </Suspense>
  );
}
