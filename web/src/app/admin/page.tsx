"use client";

import { ArrowRight, ClipboardCheck, FileSearch, Hourglass, LandPlot, Megaphone, Plus, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useAdminCompetitions, useStats } from "@/features/admin/api";
import { useAdminApplications } from "@/features/applications/api";
import { can, useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";
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
  const L = useL();
  const { data: user } = useSession();
  const seesApplications = can(user, "APPLICATIONS_VIEW");
  const seesStats = can(user, "STATS_VIEW");
  const { data: apps, isLoading } = useAdminApplications({ page: 1 }, seesApplications);
  const { data: comps } = useAdminCompetitions();
  const { data: pendingComps } = useAdminCompetitions("PENDING_APPROVAL");
  const { data: stats } = useStats(seesStats);
  const counts = apps?.status_counts ?? {};
  const canApprove = can(user, "COMPETITIONS_APPROVE");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-13 font-medium text-ink-3">{L("İdarəetmə paneli", "Administration")}</p>
          <h1 className="text-[34px] leading-tight tracking-[-0.03em]">
            {L("Xoş gəldiniz", "Welcome")}{user ? <>, <span className="text-primary">{user.full_name.split(" ")[0]}</span></> : null}
          </h1>
          <p className="text-sm text-ink-2">
            {L(
              "Müraciətlər və sənədlər, torpağın təklifə çıxarılması və müsabiqələrin təsdiqi yalnız buradan idarə olunur.",
              "Applications and documents, putting land on offer and approving competitions are managed only here."
            )}
          </p>
        </div>
        {(
          <div className="flex flex-wrap gap-2">
            {can(user, "LISTINGS_MANAGE") && (
              <Button asChild variant="secondary">
                <Link href="/admin/listings/new">
                  <Store /> {L("Yeni elan", "New listing")}
                </Link>
              </Button>
            )}
            {can(user, "AREAS_MANAGE") && (
              <Button asChild variant="secondary">
                <Link href="/admin/areas/new">
                  <LandPlot /> {L("Yeni sahə", "New plot")}
                </Link>
              </Button>
            )}
            {can(user, "COMPETITIONS_MANAGE") && (
              <Button asChild>
                <Link href="/admin/competitions/new">
                  <Plus /> {L("Yeni müsabiqə", "New competition")}
                </Link>
              </Button>
            )}
          </div>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={L("Görüləcək işlər", "Work to do")}>
        {seesApplications && (<>
        <Tile href="/admin/applications" tone="dark" icon={ClipboardCheck} label={L("Yeni müraciətlər", "New applications")} value={counts.RECEIVED} note={L("Sənədləri yoxlanılmalıdır", "Documents to check")} />
        <Tile href="/admin/applications" icon={FileSearch} label={L("Baxılır", "Under review")} value={counts.UNDER_REVIEW} note={L("Qərar gözləyir", "Awaiting a decision")} />
        <Tile href="/admin/applications" icon={Hourglass} label={L("Əlavə məlumat", "More information")} value={counts.INFO_REQUESTED} note={L("İstifadəçinin cavabı gözlənilir", "Waiting for the applicant")} />
        </>)}
        <Tile
          href="/admin/competitions"
          tone="lime"
          icon={ShieldCheck}
          label={L("Təsdiq gözləyən müsabiqələr", "Competitions to approve")}
          value={comps?.status_counts.PENDING_APPROVAL}
          note={seesStats ? `${formatNumber(stats?.competitions_open ?? 0)} ${L("açıq müsabiqə", "open competitions")}` : L("Müsabiqələr bölməsində", "In Competitions")}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {seesApplications ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>{L("Son daxil olan müraciətlər", "Latest applications")}</PanelTitle>
            <Link href="/admin/applications" className="text-13 font-semibold text-primary hover:underline">
              {L("Hamısı", "All")}
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
            <p className="px-5 py-10 text-center text-sm text-ink-2">{L("Hələ müraciət yoxdur.", "No applications yet.")}</p>
          )}
        </Panel>
        ) : (
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Sizin bölmələriniz", "Your sections")}</PanelTitle>
            </PanelHeader>
            <p className="px-5 py-6 text-sm text-ink-2">
              {L(
                "Hesabınıza verilən hüquqlara uyğun bölmələr sol menyudadır. Əlavə hüquq lazımdırsa, administratora müraciət edin.",
                "The sections your permissions allow are in the menu on the left. Ask the administrator if you need more."
              )}
            </p>
          </Panel>
        )}

        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Təsdiq gözləyir", "Awaiting approval")}</PanelTitle>
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
                      <div className="text-13 text-ink-3">{L("Son tarix", "Deadline")} {formatDate(c.deadline_at)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-2">
                {canApprove ? L("Təsdiq gözləyən müsabiqə yoxdur.", "No competitions awaiting approval.") : L("Göndərdiyiniz müsabiqələr burada görünəcək.", "Competitions you submit appear here.")}
              </p>
            )}
          </Panel>

          {seesStats && (
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Portal bir baxışda", "The portal at a glance")}</PanelTitle>
            </PanelHeader>
            <dl className="grid grid-cols-2 gap-px bg-border text-sm">
              {(
                [
                  [L("Təklif olunan sahələr", "Plots offered"), formatNumber(stats?.areas_offered ?? 0)],
                  [L("Ərazi", "Area"), formatHectares(Number(stats?.hectares_offered ?? 0))],
                  [L("Müraciətlər", "Applications"), formatNumber(stats?.applications_total ?? 0)],
                  [L("Qaliblər", "Winners"), formatNumber(stats?.decided_won ?? 0)]
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="bg-surface px-5 py-3">
                  <dt className="text-13 text-ink-3">{k}</dt>
                  <dd className="text-lg font-semibold tabular">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
