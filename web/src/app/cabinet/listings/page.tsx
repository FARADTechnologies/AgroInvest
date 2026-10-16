"use client";

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useProfile } from "@/features/applications/api";
import { useSession } from "@/features/auth/use-session";
import { type Listing, useMyListings, useWithdrawListing } from "@/features/listings/api";
import { formatAzn, formatHectares } from "@/lib/utils";

/** Elanı geri götür: the administrator takes a listing off the portal, giving a reason. */
function WithdrawListing({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const withdraw = useWithdrawListing();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) withdraw.reset();
      }}
    >
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`${listing.area_code} elanını sil`}>
        <Trash2 /> Sil
      </Button>
      <DialogContent
        title={`${listing.area_code} elanını silmək`}
        description="Sahə kataloqdan, xəritədən və müsabiqələrdən çıxarılır. Cavab gözləyən müraciətlərə bu səbəblə imtina verilir və müraciətçilərə bildiriş göndərilir. Qalibi müəyyən edilmiş elanı silmək olmaz."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            withdraw.mutate(
              { competitionId: listing.competition_id, reason: reason.trim() },
              { onSuccess: () => setOpen(false) }
            );
          }}
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Səbəb (müraciətçilər görəcək)"
            aria-label="Səbəb"
            rows={3}
            required
            minLength={5}
          />
          <FormError message={withdraw.error?.message} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                İmtina
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={withdraw.isPending || reason.trim().length < 5}>
              {withdraw.isPending ? "Silinir…" : "Elanı sil"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MyListingsPage() {
  const { data: listings, isLoading } = useMyListings();
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";
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
              <li key={`${l.competition_id}-${l.area_code}`} className="flex items-center gap-2 pr-3">
                <Link
                  href={`/areas/${l.area_code}`}
                  className="grid min-w-0 flex-1 gap-2 px-4 py-3.5 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
                {isAdmin && <WithdrawListing listing={l} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
