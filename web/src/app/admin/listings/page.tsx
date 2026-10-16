"use client";

import { ArrowRight, Inbox, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useSession } from "@/features/auth/use-session";
import { type Listing, useMyListings, useWithdrawListing } from "@/features/listings/api";
import { formatAzn, formatHectares } from "@/lib/utils";

/** Elanı sil: the administrator takes a listing off the portal, giving a reason. */
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${listing.area_code} elanını sil`}
        title="Elanı sil"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-3 transition hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-4" />
      </button>
      <DialogContent
        title={`${listing.area_code} · ${listing.title_az}`}
        description="Elan silinir: sahə kataloqdan, xəritədən və müsabiqələrdən çıxarılır. Cavab gözləyən müraciətlərə bu səbəblə imtina verilir və müraciətçilərə bildiriş gedir. Qalibi müəyyən edilmiş elanı silmək olmaz."
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
            placeholder="Səbəb (müraciətçilər görəcək), məsələn: test elanıdır"
            aria-label="Səbəb"
            rows={3}
            required
            minLength={5}
          />
          {listing.applications > 0 && (
            <p className="text-13 text-ink-2">
              Bu elana <span className="font-medium text-ink">{listing.applications}</span> müraciət var.
            </p>
          )}
          <FormError message={withdraw.error?.message} />
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                İmtina
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" disabled={withdraw.isPending || reason.trim().length < 5}>
              <Trash2 /> {withdraw.isPending ? "Silinir…" : "Elanı sil"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The listing desk: only the administrator puts land on offer as a listing. */
export default function AdminListingsPage() {
  const { data: listings, isLoading } = useMyListings();
  const { data: user } = useSession();
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] tracking-[-0.03em]">Elanlar</h1>
          <p className="mt-1 text-sm text-ink-2">Təklifə çıxarılan sahələr, son müraciət tarixi və daxil olan müraciətlər. Elanı yalnız administrator yerləşdirir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/listings/applications">
              <Inbox /> Müraciətlər
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/listings/new">
              <Plus /> Yeni elan
            </Link>
          </Button>
        </div>
      </div>

      <Panel>
        {isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !listings?.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">
            Hələ elan yoxdur. Sahəni xəritədə qeyd edib ilk elanı yerləşdirin.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {listings.map((l) => (
              <li key={`${l.competition_id}-${l.area_code}`} className="flex items-center gap-1 pr-3">
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
