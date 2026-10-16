"use client";

import { ChevronRight, Eye, FileText, Pencil, Send, ShieldCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { CompetitionStatusBadge } from "@/components/domain/competition-status";
import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import {
  type AdminCompetition,
  useAdminCompetition,
  useApproveCompetition,
  useDocumentTypes,
  useLotResult,
  useReturnCompetition,
  useSubmitCompetition
} from "@/features/admin/api";
import { useAdminApplications } from "@/features/applications/api";
import { useSession, can } from "@/features/auth/use-session";
import { ApiError } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn, formatAzn, formatDateTime, formatHectares } from "@/lib/utils";

type Lot = AdminCompetition["lots"][number];

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-13 text-ink-3">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function ReviewPanel({ comp }: { comp: AdminCompetition }) {
  const L = useL();
  const approve = useApproveCompetition(comp.id);
  const sendBack = useReturnCompetition(comp.id);
  const [comment, setComment] = useState("");
  const error = (approve.error ?? sendBack.error) as unknown;
  return (
    <Panel className="border-status-info-fg/40">
      <PanelHeader>
        <PanelTitle>{L("Rəhbərin təsdiqi", "Supervisor approval")}</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <p className="text-sm text-ink-2">
          {L(
            `Müsabiqəni ${comp.created_by_name} hazırlayıb. Şərtləri və lotları yoxlayın: təsdiqdən sonra müsabiqə portalda dərc olunur və sahələr müsabiqəyə çıxarılır.`,
            `Prepared by ${comp.created_by_name}. Check the conditions and lots: once approved, the competition is published and its plots are offered.`
          )}
        </p>
        <Textarea
          aria-label={L("Şərh", "Comment")}
          placeholder={L("Şərh (qaytarılarsa məcburidir)", "Comment (required when sending back)")}
          value={comment}
          maxLength={2000}
          onChange={(e) => setComment(e.target.value)}
        />
        <FormError message={error instanceof ApiError ? error.message : null} />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={approve.isPending || sendBack.isPending}
            onClick={() => approve.mutate(comment, { onSuccess: (c) => toast.success(L(`${c.number} təsdiq edildi və dərc olundu`, `${c.number} approved and published`)) })}
          >
            <ShieldCheck /> {L("Təsdiq et və dərc et", "Approve and publish")}
          </Button>
          <Button
            variant="secondary"
            disabled={approve.isPending || sendBack.isPending || comment.trim().length < 3}
            onClick={() => sendBack.mutate(comment, { onSuccess: () => toast.success(L("Müsabiqə düzəliş üçün qaytarıldı", "Sent back for changes")) })}
          >
            <Undo2 /> {L("Düzəlişə qaytar", "Send back for changes")}
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function SpecialistPanel({ comp }: { comp: AdminCompetition }) {
  const L = useL();
  const submit = useSubmitCompetition(comp.id);
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{L("Qaralama", "Draft")}</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <p className="text-sm text-ink-2">
          {L("Hazır olduqda müsabiqəni Rəhbərin təsdiqinə göndərin. Təsdiq gözləyərkən dəyişiklik edilə bilməz.", "When ready, send the competition for supervisor approval. It cannot be changed while awaiting approval.")}
        </p>
        <FormError message={submit.error instanceof ApiError ? submit.error.message : null} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={`/admin/competitions/${comp.id}/edit`}>
              <Pencil /> {L("Redaktə et", "Edit")}
            </Link>
          </Button>
          <Button onClick={() => setConfirming(true)}>
            <Send /> {L("Təsdiqə göndər", "Send for approval")}
          </Button>
        </div>
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent
            title={L("Təsdiqə göndərilsin?", "Send for approval?")}
            description={L("Müsabiqə Rəhbərə göndəriləcək. Onu yaradan şəxs kimi siz təsdiq edə bilməzsiniz.", "It goes to a supervisor. As its creator you cannot approve it yourself.")}
          >
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">{L("Ləğv et", "Cancel")}</Button>
              </DialogClose>
              <Button
                disabled={submit.isPending}
                onClick={() =>
                  submit.mutate(undefined, {
                    onSuccess: () => {
                      setConfirming(false);
                      toast.success(L("Rəhbərin təsdiqinə göndərildi", "Sent for supervisor approval"));
                    },
                    onError: () => setConfirming(false)
                  })
                }
              >
                {L("Göndər", "Send")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PanelBody>
    </Panel>
  );
}

function LotResultDialog({ comp, lot, onClose }: { comp: AdminCompetition; lot: Lot; onClose: () => void }) {
  const L = useL();
  const { data } = useAdminApplications({ q: lot.code, page: 1, competitionId: comp.id });
  const result = useLotResult(comp.id);
  const [winner, setWinner] = useState<string | null>(null);
  const [reasonWinner, setReasonWinner] = useState("");
  const [reasonOthers, setReasonOthers] = useState(L("Bu sahə üzrə daha yüksək qiymətləndirilmiş müraciət qalib seçildi.", "A higher-scored application was chosen as the winner for this plot."));
  const apps = (data?.items ?? []).filter((a) => a.area_code === lot.code);
  const ready = !!winner && reasonWinner.trim().length >= 3 && reasonOthers.trim().length >= 3;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`${L("Sahə üzrə nəticə", "Result for plot")} · ${lot.code}`}
        description={L("Qalib seçilən müraciət “Baxılır” statusunda olmalıdır. Bu sahə üzrə digər açıq müraciətlər səbəb göstərilməklə imtina alır.", "The winning application must be “Under review”. Other open applications for this plot are rejected with a reason.")}
        className="w-[min(94vw,640px)]"
      >
        <div className="max-h-64 overflow-y-auto rounded-2xl border border-border" role="radiogroup" aria-label={L("Qalib müraciət", "Winning application")}>
          {apps.map((a) => {
            const selectable = a.status === "UNDER_REVIEW";
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={winner === a.id}
                disabled={!selectable}
                onClick={() => setWinner(a.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-13 last:border-b-0 disabled:opacity-60",
                  winner === a.id ? "bg-primary-50" : selectable && "hover:bg-surface-2"
                )}
              >
                <span>
                  <span className="font-mono font-medium">{a.number}</span> · {a.applicant_name}
                  <span className="block text-ink-3 tabular">
                    {a.investment_azn ? formatAzn(Number(a.investment_azn)) : "—"} · {a.jobs_planned ?? "—"} {L("iş yeri", "jobs")}
                  </span>
                </span>
                <StatusBadge status={a.status} outcome={a.outcome} />
              </button>
            );
          })}
          {apps.length === 0 && <p className="px-3 py-6 text-center text-13 text-ink-2">{L("Bu sahə üzrə müraciət yoxdur.", "No applications for this plot.")}</p>}
        </div>
        <div className="mt-3 grid gap-3">
          <Textarea aria-label={L("Qalib üçün səbəb", "Reason for the winner")} placeholder={L("Qalib üçün səbəb", "Reason for the winner")} value={reasonWinner} onChange={(e) => setReasonWinner(e.target.value)} />
          <Textarea aria-label={L("Digər müraciətlər üçün səbəb", "Reason for the other applications")} value={reasonOthers} onChange={(e) => setReasonOthers(e.target.value)} />
        </div>
        <FormError message={result.error instanceof ApiError ? result.error.message : null} />
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">{L("Ləğv et", "Cancel")}</Button>
          </DialogClose>
          <Button
            disabled={!ready || result.isPending}
            onClick={() =>
              result.mutate(
                {
                  farm_area_id: lot.farm_area_id,
                  winner_application_id: winner!,
                  reason_winner: reasonWinner,
                  reason_others: reasonOthers
                },
                {
                  onSuccess: () => {
                    toast.success(L(`${lot.code} üzrə nəticə elan edildi`, `Result announced for ${lot.code}`));
                    onClose();
                  }
                }
              )
            }
          >
            {L("Nəticəni təsdiq et", "Confirm result")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const L = useL();
  const { data: comp, isLoading, error } = useAdminCompetition(id);
  const { data: user } = useSession();
  const { data: docTypes } = useDocumentTypes();
  const [resultLot, setResultLot] = useState<Lot | null>(null);

  if (error) return <div className="py-16 text-center text-ink-2">{L("Müsabiqə tapılmadı.", "Competition not found.")}</div>;
  if (isLoading || !comp) return <Skeleton className="h-96" />;

  const docName = (code: string) => docTypes?.find((d) => d.code === code)?.name_az ?? code;
  const isSpecialist = can(user, "COMPETITIONS_MANAGE");
  const isCreator = user?.id === comp.created_by_id;
  const resultsPossible = isSpecialist && !comp.is_open && (comp.status === "PUBLISHED" || comp.status === "CLOSED");

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/competitions" className="hover:text-ink">{L("Müsabiqələr", "Competitions")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{comp.number}</span>
      </nav>

      <header className="rounded-3xl border border-border/70 bg-surface shadow-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-medium">{comp.number}</span>
          <CompetitionStatusBadge status={comp.status} opensAt={comp.opens_at} deadlineAt={comp.deadline_at} />
          {comp.is_open && <DeadlineBadge iso={comp.deadline_at} />}
          {comp.status === "PUBLISHED" && (
            <Link href={`/competitions/${comp.number}`} className="ml-auto inline-flex items-center gap-1 text-13 text-primary hover:underline">
              <Eye className="size-3.5" aria-hidden /> {L("Portalda bax", "View on portal")}
            </Link>
          )}
        </div>
        <h1 className="mt-1 text-[28px] tracking-[-0.03em]">{comp.title_az}</h1>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          <Meta label={L("Qəbul", "Applications")}>{formatDateTime(comp.opens_at)} – {formatDateTime(comp.deadline_at)}</Meta>
          <Meta label={L("Hazırlayıb", "Prepared by")}>{comp.created_by_name}</Meta>
          <Meta label={L("Təsdiqə göndərilib", "Sent for approval")}>{comp.submitted_at ? formatDateTime(comp.submitted_at) : "—"}</Meta>
          <Meta label={L("Təsdiq edib", "Approved by")}>
            {comp.approved_by_name ? `${comp.approved_by_name} · ${formatDateTime(comp.approved_at!)}` : "—"}
          </Meta>
        </dl>
      </header>

      {comp.review_comment && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-sm",
            comp.status === "DRAFT"
              ? "border-status-info-fg/30 bg-status-info-bg text-status-info-fg"
              : "border-border bg-surface-2 text-ink-2"
          )}
        >
          <span className="font-medium">{comp.status === "DRAFT" ? L("Rəhbər düzəliş üçün qaytarıb:", "Sent back for changes by the supervisor:") : L("Rəhbərin şərhi:", "Supervisor's comment:")}</span>{" "}
          {comp.review_comment}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Lotlar", "Lots")}</PanelTitle>
              <span className="text-13 text-ink-2 tabular">
                {comp.lots.length} {L("sahə", "plots")} · {formatHectares(Number(comp.total_ha))} · {comp.application_count} {L("müraciət", "applications")}
              </span>
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="condensed w-full min-w-[760px] text-13">
                <thead>
                  <tr className="border-b border-border/70 bg-surface-2/60 text-left text-ink-3">
                    <th className="px-3 py-2 font-medium">Lot</th>
                    <th className="px-3 py-2 font-medium">{L("Sahə", "Plot")}</th>
                    <th className="px-3 py-2 font-medium">{L("Təyinat", "Purpose")}</th>
                    <th className="px-3 py-2 text-right font-medium">{L("Ölçü", "Size")}</th>
                    <th className="px-3 py-2 text-right font-medium">{L("Min. investisiya", "Min. investment")}</th>
                    <th className="px-3 py-2 text-right font-medium">{L("Müraciət", "Applications")}</th>
                    <th className="px-3 py-2 font-medium">{L("Qalib", "Winner")}</th>
                  </tr>
                </thead>
                <tbody className="tabular [&_td]:whitespace-nowrap">
                  {comp.lots.map((lot) => (
                    <tr key={lot.farm_area_id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 text-ink-2">{lot.lot_no}</td>
                      <td className="px-3 py-2">
                        <Link href={`/areas/${lot.code}`} className="font-mono font-medium text-primary hover:underline">{lot.code}</Link>
                        <span className="block text-2xs text-ink-3">{lot.rayon_name}</span>
                      </td>
                      <td className="px-3 py-2"><PurposeChip purpose={lot.purpose} /></td>
                      <td className="px-3 py-2 text-right">{formatHectares(Number(lot.area_ha))}</td>
                      <td className="px-3 py-2 text-right">{lot.min_investment_azn ? formatAzn(Number(lot.min_investment_azn)) : "—"}</td>
                      <td className="px-3 py-2 text-right">{lot.applications}</td>
                      <td className="px-3 py-2">
                        {lot.winner_number ? (
                          <span className="font-mono text-status-won-fg">{lot.winner_number}</span>
                        ) : resultsPossible && lot.applications > 0 ? (
                          <Button size="sm" variant="secondary" onClick={() => setResultLot(lot)}>
                            {L("Nəticəni elan et", "Announce result")}
                          </Button>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Təsvir və şərtlər", "Description and conditions")}</PanelTitle>
            </PanelHeader>
            <PanelBody className="space-y-2 text-sm">
              <p className="text-ink-2">{comp.description_az}</p>
              <p className="leading-relaxed">{comp.conditions_az}</p>
            </PanelBody>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          {comp.can_review && <ReviewPanel comp={comp} />}
          {comp.can_submit && <SpecialistPanel comp={comp} />}
          {comp.status === "PENDING_APPROVAL" && !comp.can_review && (
            <Panel>
              <PanelBody className="space-y-1 text-sm">
                <div className="font-medium">{L("Rəhbərin təsdiqini gözləyir", "Awaiting supervisor approval")}</div>
                <p className="text-ink-2">
                  {isCreator
                    ? L("Dörd göz prinsipi: müsabiqəni yaradan şəxs onu təsdiq edə bilməz. Başqa Rəhbər təsdiq etməlidir.", "Four-eyes principle: the creator cannot approve it. Another supervisor must.")
                    : L("Təsdiq yalnız Rəhbər tərəfindən verilir.", "Only a supervisor can approve.")}
                </p>
              </PanelBody>
            </Panel>
          )}
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Tələb olunan sənədlər", "Required documents")}</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-border">
              {comp.required_documents.map((d) => (
                <li key={d.code} className="flex gap-2.5 px-4 py-2 text-sm">
                  <FileText className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  <span>
                    {docName(d.code)}
                    {!d.mandatory && <span className="text-ink-3"> ({L("könüllü", "optional")})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {resultLot && <LotResultDialog comp={comp} lot={resultLot} onClose={() => setResultLot(null)} />}
    </div>
  );
}
