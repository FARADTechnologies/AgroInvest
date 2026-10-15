"use client";

import { ArrowRight, CircleAlert, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useMyApplications, useProfile } from "@/features/applications/api";
import { useSession } from "@/features/auth/use-session";
import { useT } from "@/lib/i18n";
import { formatAzn, formatDate, formatHectares } from "@/lib/utils";

export default function CabinetHome() {
  const t = useT();
  const router = useRouter();
  const { data: user } = useSession();
  const investor = user?.role === "INVESTOR";
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: apps, isLoading } = useMyApplications(investor);

  // A sahibkar's cabinet starts at their listings.
  useEffect(() => {
    if (user?.role === "ENTREPRENEUR") router.replace("/cabinet/listings");
  }, [user, router]);
  if (!investor) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Müraciətlərim</h1>
          <p className="mt-1 text-sm text-ink-2">Müraciətlərin statusu, qərarlar və tələb olunan əlavə məlumatlar.</p>
        </div>
        <Button asChild>
          <Link href="/catalogue?open=1">
            <Plus /> Yeni müraciət
          </Link>
        </Button>
      </div>

      {!profileLoading && !profile && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-status-info-fg/30 bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4" aria-hidden /> Müraciət etmək üçün investor məlumatlarını doldurun.
          </span>
          <Link href="/cabinet/profile" className="font-medium underline">
            Məlumatları doldur
          </Link>
        </div>
      )}

      <Panel>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !apps?.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">
            Hələ müraciətiniz yoxdur. Xəritədə və ya kataloqda uyğun sahəni seçib müraciət edin.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {apps.map((a) => (
              <li key={a.id}>
                <Link
                  href={a.status === "DRAFT" ? `/cabinet/applications/new?area=${a.area_code}&id=${a.id}` : `/cabinet/applications/${a.id}`}
                  className="grid gap-2 px-4 py-3.5 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium">{a.number ?? "Qaralama"}</span>
                      <StatusBadge status={a.status} outcome={a.outcome} />
                    </div>
                    <div className="mt-1 truncate text-sm text-ink">
                      {a.area_code} · {a.area_name}
                    </div>
                    <div className="text-13 text-ink-3">
                      {a.rayon_name} · {t.purpose[a.purpose]} · {formatHectares(Number(a.area_ha))} · {a.competition_number}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-13 text-ink-2 sm:justify-end">
                    {a.investment_azn && <span className="tabular">{formatAzn(Number(a.investment_azn))}</span>}
                    <span>{a.submitted_at ? `Göndərilib ${formatDate(a.submitted_at)}` : "Göndərilməyib"}</span>
                    <ArrowRight className="size-4 text-ink-3" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
