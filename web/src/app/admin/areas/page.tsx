"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AreaStatusBadge, DeminingBadge, useAreaStatusLabel } from "@/components/domain/area-status";
import { useL } from "@/lib/i18n";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/panel";
import { type AdminAreaRow, useAdminAreas } from "@/features/admin/api";
import { useSession } from "@/features/auth/use-session";
import { cn, formatHectares } from "@/lib/utils";

const TABS: (AdminAreaRow["status"] | "")[] = ["", "AVAILABLE", "IN_COMPETITION", "ALLOCATED", "DRAFT", "WITHDRAWN"];
const SOURCE: Record<string, string> = { OSM: "OSM", SYNTHETIC: "Sintetik", MANUAL: "Əl ilə", EKTIS: "EKTİS" };
const SOURCE_EN: Record<string, string> = { OSM: "OSM", SYNTHETIC: "Synthetic", MANUAL: "Manual", EKTIS: "EKTIS" };

function AreasTable() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") ?? "") as AdminAreaRow["status"] | "";
  const L = useL();
  const statusLabel = useAreaStatusLabel();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: user } = useSession();
  const { data: all } = useAdminAreas(undefined, query);
  const rows = (all ?? []).filter((a) => !status || a.status === status);
  const count = (s: string) => (all ?? []).filter((a) => a.status === s).length;
  const canEdit = user?.role === "SPECIALIST" || user?.role === "ADMIN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] tracking-[-0.03em]">{L("Təsərrüfat sahələri", "Farm areas")}</h1>
          <p className="text-13 text-ink-2">{L("Ölçü, rayon və ən yaxın yaşayış məntəqəsi poliqondan avtomatik hesablanır.", "Size, district and nearest settlement are calculated from the polygon automatically.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Kod, ad və ya rayon", "Code, name or district")} className="pl-8" aria-label={L("Sahə axtar", "Search areas")} />
          </div>
          {canEdit && (
            <Button asChild>
              <Link href="/admin/areas/new">
                <Plus /> {L("Yeni sahə", "New area")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 shadow-card" role="tablist">
        {TABS.map((s) => (
          <button
            key={s || "all"}
            role="tab"
            aria-selected={s === status}
            onClick={() => router.replace(s ? `/admin/areas?status=${s}` : "/admin/areas", { scroll: false })}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
              s === status ? "bg-primary font-medium text-primary-fg [&>span]:bg-white/15 [&>span]:text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            {s ? statusLabel(s) : L("Hamısı", "All")}
            <span className="rounded-full bg-surface-2 px-2 text-13 tabular text-ink-2">{s ? count(s) : all?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-3xl border border-border/70 bg-surface shadow-card">
        <table className="condensed w-full min-w-[980px] text-13">
          <thead>
            <tr className="border-b border-border/70 bg-surface-2/60 text-left text-ink-3">
              <th className="px-3 py-2 font-medium">{L("Kod", "Code")}</th>
              <th className="px-3 py-2 font-medium">{L("Ad", "Name")}</th>
              <th className="px-3 py-2 font-medium">{L("Rayon", "District")}</th>
              <th className="px-3 py-2 font-medium">{L("Təyinat", "Purpose")}</th>
              <th className="px-3 py-2 text-right font-medium">{L("Ölçü", "Size")}</th>
              <th className="px-3 py-2 font-medium">{L("Minatəmizləmə", "Demining")}</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">{L("Müsabiqə", "Competition")}</th>
              <th className="px-3 py-2 font-medium">{L("Mənbə", "Source")}</th>
            </tr>
          </thead>
          <tbody className="tabular [&_td]:whitespace-nowrap">
            {!all &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              ))}
            {rows.map((a) => (
              <tr
                key={a.id}
                onClick={() => router.push(`/admin/areas/${a.id}`)}
                className="cursor-pointer border-b border-border last:border-b-0 hover:bg-primary-50/50"
              >
                <td className="px-3 py-2">
                  <Link href={`/admin/areas/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-mono font-medium text-primary hover:underline">
                    {a.code}
                  </Link>
                </td>
                <td className="max-w-[240px] truncate px-3 py-2" title={a.name_az}>{a.name_az}</td>
                <td className="px-3 py-2 text-ink-2">{a.rayon_name}</td>
                <td className="px-3 py-2"><PurposeChip purpose={a.purpose} /></td>
                <td className="px-3 py-2 text-right">{formatHectares(Number(a.area_ha))}</td>
                <td className="px-3 py-2"><DeminingBadge status={a.demining_status} /></td>
                <td className="px-3 py-2"><AreaStatusBadge status={a.status} /></td>
                <td className="px-3 py-2 font-mono text-ink-2">{a.competition_number ?? "—"}</td>
                <td className="px-3 py-2 text-ink-2">{L(SOURCE[a.data_source], SOURCE_EN[a.data_source])}</td>
              </tr>
            ))}
            {all && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-ink-2">{L("Sahə tapılmadı.", "No areas found.")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminAreasPage() {
  return (
    <Suspense>
      <AreasTable />
    </Suspense>
  );
}
