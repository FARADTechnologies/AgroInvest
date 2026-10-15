"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { useMyListings } from "@/features/listings/api";
import { formatAzn, formatHectares } from "@/lib/utils";

export default function MyListingsPage() {
  const { data: listings, isLoading } = useMyListings();
  const { data: profile, isLoading: profileLoading } = useProfile();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Elanlarım</h1>
          <p className="mt-1 text-sm text-ink-2">Yerləşdirdiyiniz sahələr, son müraciət tarixi və investorların müraciətləri.</p>
        </div>
        <Button asChild>
          <Link href="/cabinet/listings/new">
            <Plus /> Yeni elan
          </Link>
        </Button>
      </div>

      {!profileLoading && !profile && (
        <p className="rounded-md border border-status-info-fg/30 bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
          Elan yerləşdirmək üçün əvvəlcə{" "}
          <Link href="/cabinet/profile" className="font-medium underline">
            sahibkar məlumatlarını
          </Link>{" "}
          doldurun.
        </p>
      )}

      <Panel>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !listings?.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">
            Hələ elanınız yoxdur. Sahəni xəritədə qeyd edib ilk elanınızı yerləşdirin.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {listings.map((l) => (
              <li key={`${l.competition_id}-${l.area_code}`}>
                <Link
                  href={`/areas/${l.area_code}`}
                  className="grid gap-2 px-4 py-3.5 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium">{l.area_code}</span>
                      <PurposeChip purpose={l.purpose} />
                      <DeadlineBadge iso={l.deadline_at} />
                    </div>
                    <div className="mt-1 truncate text-sm text-ink">{l.title_az}</div>
                    <div className="text-13 text-ink-3">
                      {l.rayon_name} · {formatHectares(Number(l.area_ha))} · {l.number}
                      {l.min_investment_azn ? ` · min. ${formatAzn(Number(l.min_investment_azn))}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-13 text-ink-2 sm:justify-end">
                    <span className="tabular">
                      <span className="font-medium text-ink">{l.applications}</span> müraciət
                    </span>
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
