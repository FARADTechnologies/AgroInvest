"use client";

import { ArrowRight, ClipboardCheck, FileSearch, Hourglass, LandPlot, Megaphone, Plus, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useAdminCompetitions, useStats } from "@/features/admin/api";
import { useAdminApplications } from "@/features/applications/api";
import { useSession } from "@/features/auth/use-session";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

function Tile({
  href,
  label,
  value,
  note,
  icon: Icon,
  tone = "plain"
}: {
  href: string;
  label: string;
  value: number | undefined;
  note: string;
  icon: typeof LandPlot;
  tone?: "plain" | "dark" | "lime";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-3xl p-5 shadow-card transition hover:-translate-y-0.5",
        tone === "dark" && "bg-primary text-white",
        tone === "lime" && "bg-accent text-ink",
        tone === "plain" && "border border-border/70 bg-surface"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl",
            tone === "dark" ? "bg-white/10 text-accent" : tone === "lime" ? "bg-ink text-accent" : "bg-primary-50 text-primary"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowRight className="size-4 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-80" aria-hidden />
      </div>
      <div className="mt-4 text-4xl font-semibold tracking-[-0.03em] tabular">{value ?? "…"}</div>
      <div className="mt-1 text-sm font-semibold">{label}</div>
      <div className={cn("text-13", tone === "dark" ? "text-white/60" : "text-ink-3")}>{note}</div>
    </Link>
  );
}

export default function AdminHome() {
  const { data: user } = useSession();
  const { data: apps, isLoading } = useAdminApplications({ page: 1 });
  const { data: comps } = useAdminCompetitions();
  const { data: pendingComps } = useAdminCompetitions("PENDING_APPROVAL");
  const { data: stats } = useStats();
  const counts = apps?.status_counts ?? {};
  const canApprove = user?.role === "ADMIN" || user?.role === "SUPERVISOR";
  const canEdit = user?.role === "ADMIN" || user?.role === "SPECIALIST";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-13 font-medium text-ink-3">İdarəetmə paneli</p>
          <h1 className="text-[34px] leading-tight tracking-[-0.03em]">
            Xoş gəldiniz{user ? <>, <span className="text-primary">{user.full_name.split(" ")[0]}</span></> : null}
          </h1>
          <p className="text-sm text-ink-2">
            Müraciətlər və sənədlər, torpağın təklifə çıxarılması və müsabiqələrin təsdiqi yalnız buradan idarə olunur.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {user?.role === "ADMIN" && (
              <Button asChild variant="secondary">
                <Link href="/admin/listings/new">
                  <Store /> Yeni elan
                </Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/admin/areas/new">
                <LandPlot /> Yeni sahə
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/competitions/new">
                <Plus /> Yeni müsabiqə
              </Link>
            </Button>
          </div>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Görüləcək işlər">
        <Tile href="/admin/applications" tone="dark" icon={ClipboardCheck} label="Yeni müraciətlər" value={counts.RECEIVED} note="Sənədləri yoxlanılmalıdır" />
        <Tile href="/admin/applications" icon={FileSearch} label="Baxılır" value={counts.UNDER_REVIEW} note="Qərar gözləyir" />
        <Tile href="/admin/applications" icon={Hourglass} label="Əlavə məlumat" value={counts.INFO_REQUESTED} note="İstifadəçinin cavabı gözlənilir" />
        <Tile
          href="/admin/competitions"
          tone="lime"
          icon={ShieldCheck}
          label="Təsdiq gözləyən müsabiqələr"
          value={comps?.status_counts.PENDING_APPROVAL}
          note={`${formatNumber(stats?.competitions_open ?? 0)} açıq müsabiqə`}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel>
          <PanelHeader>
            <PanelTitle>Son daxil olan müraciətlər</PanelTitle>
            <Link href="/admin/applications" className="text-13 font-semibold text-primary hover:underline">
              Hamısı
            </Link>
          </PanelHeader>
          {isLoading ? (
            <Skeleton className="m-4 h-56" />
          ) : apps && apps.items.length > 0 ? (
            <ul className="divide-y divide-border">
              {apps.items.slice(0, 7).map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/applications/${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-surface-2">
                    <span className="w-36 font-mono text-13 font-medium">{a.number ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{a.applicant_name ?? "—"}</span>
                      <span className="block truncate text-13 text-ink-3">
                        {a.area_code} · {a.rayon_name} · {formatHectares(Number(a.area_ha))}
                      </span>
                    </span>
                    {a.investment_azn != null && (
                      <span className="text-13 tabular text-ink-2">{formatAzn(Number(a.investment_azn))}</span>
                    )}
                    <StatusBadge status={a.status} outcome={a.outcome} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-ink-2">Hələ müraciət yoxdur.</p>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>Təsdiq gözləyir</PanelTitle>
              <Megaphone className="size-4 text-ink-3" aria-hidden />
            </PanelHeader>
            {pendingComps && pendingComps.items.length > 0 ? (
              <ul className="divide-y divide-border">
                {pendingComps.items.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/competitions/${c.id}`} className="block px-5 py-3 transition-colors hover:bg-surface-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-13 font-medium">{c.number}</span>
                        <CompetitionStatusBadge status={c.status} />
                      </div>
                      <div className="mt-0.5 truncate text-sm">{c.title_az}</div>
                      <div className="text-13 text-ink-3">Son tarix {formatDate(c.deadline_at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-2">
                {canApprove ? "Təsdiq gözləyən müsabiqə yoxdur." : "Göndərdiyiniz müsabiqələr burada görünəcək."}
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Portal bir baxışda</PanelTitle>
            </PanelHeader>
            <dl className="grid grid-cols-2 gap-px bg-border text-sm">
              {(
                [
                  ["Təklif olunan sahələr", formatNumber(stats?.areas_offered ?? 0)],
                  ["Ərazi", formatHectares(Number(stats?.hectares_offered ?? 0))],
                  ["Müraciətlər", formatNumber(stats?.applications_total ?? 0)],
                  ["Qaliblər", formatNumber(stats?.decided_won ?? 0)]
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="bg-surface px-5 py-3">
                  <dt className="text-13 text-ink-3">{k}</dt>
                  <dd className="text-lg font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
