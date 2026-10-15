"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { COMPETITION_STATUS_LABEL, CompetitionStatusBadge } from "@/components/domain/competition-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { type CompetitionStatus, useAdminCompetitions } from "@/features/admin/api";
import { useSession } from "@/features/auth/use-session";
import { cn, formatDate, formatHectares } from "@/lib/utils";

const TABS: (CompetitionStatus | "")[] = ["", "DRAFT", "PENDING_APPROVAL", "PUBLISHED", "CLOSED"];

function CompetitionsTable() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") ?? "") as CompetitionStatus | "";
  const { data: user } = useSession();
  const { data, isLoading } = useAdminCompetitions(status || undefined);
  const { data: all } = useAdminCompetitions();
  const counts = all?.status_counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const canCreate = user?.role === "SPECIALIST" || user?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] tracking-[-0.03em]">Müsabiqələr</h1>
          <p className="text-13 text-ink-2">
            Mütəxəssis müsabiqəni hazırlayır, Rəhbər təsdiq edir. Müsabiqəni yaradan şəxs onu təsdiq edə bilməz.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/admin/competitions/new">
              <Plus /> Yeni müsabiqə
            </Link>
          </Button>
        )}
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 shadow-card" role="tablist">
        {TABS.map((s) => {
          const active = s === status;
          return (
            <button
              key={s || "all"}
              role="tab"
              aria-selected={active}
              onClick={() => router.replace(s ? `/admin/competitions?status=${s}` : "/admin/competitions", { scroll: false })}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-primary font-medium text-primary-fg [&>span]:bg-white/15 [&>span]:text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
            >
              {s ? (s === "PUBLISHED" ? "Dərc edilib" : COMPETITION_STATUS_LABEL[s]) : "Hamısı"}
              <span className="rounded-full bg-surface-2 px-2 text-13 tabular text-ink-2">{s ? counts[s] ?? 0 : total}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border/70 bg-surface shadow-card">
        <table className="condensed w-full min-w-[900px] text-13">
          <thead>
            <tr className="border-b border-border/70 bg-surface-2/60 text-left text-ink-3">
              <th className="px-3 py-2 font-medium">Nömrə</th>
              <th className="px-3 py-2 font-medium">Ad</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Lotlar</th>
              <th className="px-3 py-2 text-right font-medium">Ərazi</th>
              <th className="px-3 py-2 text-right font-medium">Müraciətlər</th>
              <th className="px-3 py-2 font-medium">Son tarix</th>
              <th className="px-3 py-2 font-medium">Hazırlayıb</th>
              <th className="px-3 py-2 font-medium">Təsdiq edib</th>
            </tr>
          </thead>
          <tbody className="tabular [&_td]:whitespace-nowrap">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              ))}
            {data?.items.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/admin/competitions/${c.id}`)}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-primary-50/50"
              >
                <td className="px-3 py-2">
                  <Link href={`/admin/competitions/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-medium text-primary hover:underline">
                    {c.number}
                  </Link>
                </td>
                <td className="max-w-[320px] truncate px-3 py-2 text-ink" title={c.title_az}>{c.title_az}</td>
                <td className="px-3 py-2"><CompetitionStatusBadge status={c.status} opensAt={c.opens_at} deadlineAt={c.deadline_at} /></td>
                <td className="px-3 py-2 text-right">{c.lots.length}</td>
                <td className="px-3 py-2 text-right">{formatHectares(Number(c.total_ha))}</td>
                <td className="px-3 py-2 text-right">{c.application_count}</td>
                <td className="px-3 py-2 text-ink-2">{formatDate(c.deadline_at)}</td>
                <td className="px-3 py-2 text-ink-2">{c.created_by_name}</td>
                <td className="px-3 py-2 text-ink-2">{c.approved_by_name ?? "—"}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-ink-2">Bu statusda müsabiqə yoxdur.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminCompetitionsPage() {
  return (
    <Suspense>
      <CompetitionsTable />
    </Suspense>
  );
}
