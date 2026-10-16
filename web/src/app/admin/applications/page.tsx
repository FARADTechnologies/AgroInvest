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
import { useL, useT } from "@/lib/i18n";
import { cn, daysUntil, formatDate, formatNumber } from "@/lib/utils";

const TABS: (ApplicationStatus | "")[] = ["", "RECEIVED", "UNDER_REVIEW", "INFO_REQUESTED", "DECIDED"];

function daysSince(iso: string) {
  return Math.max(0, -daysUntil(iso) + 1);
}

function ApplicationsTable() {
  const t = useT();
  const L = useL();
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
          <h1 className="text-[28px] tracking-[-0.03em]">{L("Daxil olan müraciətlər", "Incoming applications")}</h1>
          <p className="text-13 text-ink-2">{L("FİN və VÖEN siyahıda maskalanır; müraciətə hər baxış audit jurnalına yazılır.", "Personal and tax IDs are masked in the list; every view of an application is written to the audit log.")}</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={L("Nömrə, müraciətçi və ya sahə kodu", "Number, applicant or plot code")}
            className="pl-8"
            aria-label={L("Müraciət axtar", "Search applications")}
          />
        </div>
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 shadow-card" role="tablist">
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
                "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-primary font-medium text-primary-fg [&>span]:bg-white/15 [&>span]:text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              {s ? t.status[s] : L("Hamısı", "All")}
              <span className="rounded-full bg-surface-2 px-2 text-13 tabular text-ink-2">{count}</span>
            </button>
          );
        })}
        {isFetching && <span className="ml-auto self-center text-13 text-ink-3">{L("Yenilənir…", "Updating…")}</span>}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border/70 bg-surface shadow-card">
        <table className="condensed w-full min-w-[960px] text-13">
          <thead>
            <tr className="border-b border-border/70 bg-surface-2/60 text-left text-ink-3">
              <th className="px-3 py-2 font-medium">{L("Nömrə", "Number")}</th>
              <th className="px-3 py-2 font-medium">{L("Müraciətçi", "Applicant")}</th>
              <th className="px-3 py-2 font-medium">{L("FİN / VÖEN", "Personal / tax ID")}</th>
              <th className="px-3 py-2 font-medium">{L("Sahə", "Plot")}</th>
              <th className="px-3 py-2 font-medium">{L("Müsabiqə", "Competition")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("İnvestisiya, AZN", "Investment, AZN")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("İş yeri", "Jobs")}</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">{L("Daxil olub", "Received")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("Statusda", "In status")}</th>
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
                <td className="px-3 py-2 text-right text-ink-2">{daysSince(a.last_status_at)} {L("gün", "d")}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-ink-2">
                  {L("Müraciət tapılmadı.", "No applications found.")}
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
