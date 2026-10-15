"use client";

import { ChevronRight, Download, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { StatusTimeline } from "@/components/domain/status-timeline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import {
  type Application,
  type ApplicationStatus,
  useAdminApplication,
  useRevealIdentifier,
  useTransition
} from "@/features/applications/api";
import { formatSize } from "@/features/applications/document-slot";
import { useSession } from "@/features/auth/use-session";
import { useOutbox } from "@/features/integration/api";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, daysUntil, formatAzn, formatDate, formatDateTime, formatHectares, formatNumber } from "@/lib/utils";

/**
 * The applicant's FİN/VÖEN, masked by default. A specialist can show it in full after
 * giving a reason; the reason and the access are written to the audit log.
 */
function IdentifierReveal({ applicationId, label, masked }: { applicationId: string; label: string; masked: string }) {
  const { data: user } = useSession();
  const canReveal = user?.role === "SPECIALIST" || user?.role === "ADMIN";
  const reveal = useRevealIdentifier(applicationId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const shown = reveal.data?.identifier;

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-13 text-ink-2">
      {label} {shown ?? masked}
      {shown ? (
        <span className="inline-flex items-center gap-1 font-sans text-2xs text-status-info-fg" title="Baxış audit jurnalına yazıldı">
          <Eye className="size-3.5" aria-hidden /> audit jurnalına yazıldı
        </span>
      ) : canReveal ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded px-1 font-sans text-2xs text-primary hover:bg-primary-50"
        >
          <EyeOff className="size-3.5" aria-hidden /> Göstər
        </button>
      ) : (
        <EyeOff className="size-3.5 text-ink-3" aria-label="maskalanıb" />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`${label} tam göstərilsin?`}
          description="Siyahılarda identifikator maskalanır. Tam dəyər yalnız zərurət olduqda göstərilir; səbəb və baxış audit jurnalına yazılır."
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Məsələn: VÖEN şəhadətnaməsi ilə tutuşdurma"
            aria-label="Səbəb"
          />
          {reveal.error && <FormError message={reveal.error instanceof ApiError ? reveal.error.message : "Xəta"} />}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Ləğv et</Button>
            </DialogClose>
            <Button
              disabled={reason.trim().length < 5 || reveal.isPending}
              onClick={() => reveal.mutate(reason.trim(), { onSuccess: () => setOpen(false) })}
            >
              Göstər
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

/** Where the winning decision is on its way to EKTIS (outbox state). */
function EktisDelivery({ applicationId }: { applicationId: string }) {
  const { data } = useOutbox(applicationId);
  const m = data?.[0];
  if (!data) return <Skeleton className="h-5 w-40" />;
  if (!m) return <span className="text-ink-2">Növbəyə yazılmayıb</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      {m.status === "SENT" ? (
        <span className="text-status-won-fg">
          Çatdırılıb · <span className="font-mono">{m.ektis_reference}</span>
          {m.confirmed_at && (
            <>
              {" "}· təsdiqləndi <span className="font-mono">{m.land_use_right_id}</span>
            </>
          )}
        </span>
      ) : m.status === "PENDING" ? (
        <span className="text-status-info-fg">Növbədə · cəhd {m.attempts}</span>
      ) : (
        <span className="text-status-rejected-fg">Uğursuz · {m.attempts} cəhd</span>
      )}
      <Link href="/admin/integration" className="text-13 text-primary hover:underline">
        İnteqrasiya logu
      </Link>
    </span>
  );
}

const ACTION_LABEL: Record<string, { title: string; hint: string }> = {
  UNDER_REVIEW: { title: "Baxılmağa götür", hint: "Status “Baxılır” olur, investor bildiriş alır" },
  INFO_REQUESTED: { title: "Əlavə məlumat tələb et", hint: "Səbəb və lazım olan sənədlər investora göndərilir" },
  DECIDED: { title: "Qərar ver", hint: "Yekun qərar: Qalib və ya İmtina, səbəb göstərilməklə" }
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function ActionPanel({ app }: { app: Application }) {
  const t = useT();
  const transition = useTransition(app.id);
  const [to, setTo] = useState<ApplicationStatus | null>(app.allowed_transitions[0] ?? null);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"WON" | "REJECTED" | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setTo(app.allowed_transitions[0] ?? null);
    setReason("");
    setOutcome(null);
    setDocs([]);
  }, [app.status, app.allowed_transitions]);

  if (!app.allowed_transitions.length) {
    const waiting = app.status === "INFO_REQUESTED";
    return (
      <Panel>
        <PanelBody className="space-y-2 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="size-4 text-ink-3" aria-hidden />
            {app.status === "DECIDED" ? "Qərar yekundur" : waiting ? "İnvestorun cavabı gözlənilir" : "Əməliyyat yoxdur"}
          </div>
          <p className="text-ink-2">
            {app.status === "DECIDED"
              ? "Verilmiş qərar dəyişdirilə bilməz; bütün addımlar tarixçədə qeydə alınıb."
              : waiting
                ? "İnvestor tələb olunan məlumatı göndərdikdə müraciət avtomatik olaraq “Baxılır” statusuna qayıdacaq."
                : "Sizin rolunuz bu müraciətə yalnız baxış hüququ verir."}
          </p>
        </PanelBody>
      </Panel>
    );
  }

  const needsReason = to === "INFO_REQUESTED" || to === "DECIDED";
  const ready = !!to && (!needsReason || reason.trim().length >= 3) && (to !== "DECIDED" || !!outcome);

  const send = () =>
    transition.mutate(
      {
        to: to!,
        reason: reason.trim() || null,
        outcome: to === "DECIDED" ? outcome : null,
        requested_doc_types: to === "INFO_REQUESTED" ? docs : [],
        expected_version: app.version
      },
      {
        onSuccess: (a) => {
          setConfirming(false);
          toast.success(`Status dəyişdirildi: ${t.status[a.status]}`);
        },
        onError: () => setConfirming(false)
      }
    );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Növbəti addım</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="space-y-1.5" role="radiogroup" aria-label="Əməliyyat">
          {app.allowed_transitions.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={to === s}
              onClick={() => setTo(s)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left",
                to === s ? "border-primary bg-primary-50" : "border-border hover:border-border-strong"
              )}
            >
              <span
                className={cn(
                  "mt-1 size-3.5 shrink-0 rounded-full border-2",
                  to === s ? "border-primary bg-primary shadow-[inset_0_0_0_2px_white]" : "border-border-strong"
                )}
                aria-hidden
              />
              <span>
                <span className="block text-sm font-medium">{ACTION_LABEL[s].title}</span>
                <span className="block text-13 text-ink-3">{ACTION_LABEL[s].hint}</span>
              </span>
            </button>
          ))}
        </div>

        {to === "DECIDED" && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nəticə">
            {(["WON", "REJECTED"] as const).map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={outcome === o}
                onClick={() => setOutcome(o)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium",
                  outcome === o
                    ? o === "WON"
                      ? "border-status-won-fg bg-status-won-bg text-status-won-fg"
                      : "border-status-rejected-fg bg-status-rejected-bg text-status-rejected-fg"
                    : "border-border text-ink-2 hover:border-border-strong"
                )}
              >
                {t.outcome[o]}
              </button>
            ))}
          </div>
        )}

        {to === "INFO_REQUESTED" && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-13 font-medium text-ink-2">Tələb olunan sənədlər (könüllü)</legend>
            {app.required_documents.map((d) => (
              <label key={d.code} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={docs.includes(d.code)}
                  onCheckedChange={(v) => setDocs((cur) => (v ? [...cur, d.code] : cur.filter((c) => c !== d.code)))}
                />
                {d.name_az}
              </label>
            ))}
          </fieldset>
        )}

        <div>
          <label htmlFor="reason" className="text-13 font-medium text-ink-2">
            Səbəb{needsReason && <span className="text-danger"> *</span>}
          </label>
          <Textarea
            id="reason"
            className="mt-1.5"
            value={reason}
            maxLength={3000}
            onChange={(e) => setReason(e.target.value)}
            placeholder={needsReason ? "İnvestora göstəriləcək səbəb" : "Könüllü qeyd"}
          />
          <p className="mt-1 text-13 text-ink-3">Səbəb investorun tarixçəsində görünür.</p>
        </div>

        <FormError message={transition.error instanceof ApiError ? transition.error.message : null} />
        <Button
          className="w-full"
          disabled={!ready || transition.isPending}
          onClick={() => (to === "DECIDED" ? setConfirming(true) : send())}
        >
          Təsdiq et
        </Button>

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent
            title={`Qərar: ${outcome ? t.outcome[outcome] : ""}`}
            description={
              outcome === "WON"
                ? "Qərar yekundur, investora bildiriş göndəriləcək və torpaqdan istifadə qərarı EKTİS-ə ötürüləcək."
                : "Qərar yekundur, investora səbəb göstərilməklə bildiriş göndəriləcək."
            }
          >
            <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">{reason}</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Ləğv et</Button>
              </DialogClose>
              <Button variant={outcome === "REJECTED" ? "danger" : "primary"} disabled={transition.isPending} onClick={send}>
                Qərarı təsdiq et
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PanelBody>
    </Panel>
  );
}

export default function AdminApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data: app, isLoading, error } = useAdminApplication(id);
  const [tab, setTab] = useState<"general" | "plan" | "docs" | "history">("general");

  if (error) return <div className="py-16 text-center text-ink-2">Müraciət tapılmadı.</div>;
  if (isLoading || !app) return <Skeleton className="h-96" />;

  const a = app.applicant;
  const plan = app.business_plan;
  const mandatory = app.required_documents.filter((d) => d.mandatory);
  const attached = mandatory.filter((d) => d.document).length;
  const tabs = [
    ["general", "Ümumi"],
    ["plan", "Biznes plan"],
    ["docs", `Sənədlər ${attached}/${mandatory.length}`],
    ["history", "Tarixçə"]
  ] as const;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/applications" className="hover:text-ink">Müraciətlər</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{app.number}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-surface px-4 py-3">
        <span className="font-mono text-lg font-medium">{app.number}</span>
        <StatusBadge status={app.status} outcome={app.outcome} />
        <span className="text-sm text-ink">{a?.display_name}</span>
        {a && <IdentifierReveal applicationId={app.id} label={a.identifier_label} masked={a.identifier} />}
        <span className="ml-auto text-13 text-ink-3">
          Daxil olub: {app.submitted_at ? `${formatDate(app.submitted_at)} (${Math.max(0, -daysUntil(app.submitted_at) + 1)} gün)` : "—"}
        </span>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex gap-1 border-b border-border" role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm",
                  tab === key ? "border-primary font-medium text-primary" : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Panel className="mt-3">
            <PanelBody>
              {tab === "general" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <section>
                    <h2 className="mb-1 text-13 font-medium uppercase tracking-wide text-ink-3">İnvestor</h2>
                    <dl>
                      <Row label="Növ">{a?.type === "COMPANY" ? "Hüquqi şəxs" : "Fiziki şəxs"}</Row>
                      <Row label="Ad">{a?.display_name}</Row>
                      {a?.company_name && <Row label="Nümayəndə">{a.full_name}</Row>}
                      <Row label={a?.identifier_label ?? "FİN"}><span className="font-mono">{a?.identifier}</span></Row>
                      <Row label="Telefon">{a?.phone}</Row>
                      <Row label="E-poçt">{a?.email}</Row>
                      {a?.address && <Row label="Ünvan">{a.address}</Row>}
                      <Row label="Yerli investor">{a?.is_local ? `Bəli${a.origin_rayon_name ? ` · ${a.origin_rayon_name}` : ""}` : "Xeyr"}</Row>
                      <Row label="EKTİS fermer">
                        {a?.ektis_farmer_id ? <span className="font-mono">{a.ektis_farmer_id}</span> : "Qeydiyyat təsdiqlənməyib"}
                      </Row>
                    </dl>
                  </section>
                  <section>
                    <h2 className="mb-1 text-13 font-medium uppercase tracking-wide text-ink-3">Sahə və müsabiqə</h2>
                    <dl>
                      <Row label="Sahə">
                        <Link href={`/areas/${app.area.code}`} className="font-mono text-primary hover:underline">{app.area.code}</Link>{" "}
                        {app.area.name_az}
                      </Row>
                      <Row label="Rayon">{app.area.rayon_name}</Row>
                      <Row label="Ölçü">{formatHectares(Number(app.area.area_ha))}</Row>
                      <Row label="Təyinat"><PurposeChip purpose={app.area.purpose} /></Row>
                      <Row label="Fəaliyyət">{t.purpose[app.activity]}</Row>
                      <Row label="Müsabiqə"><span className="font-mono">{app.competition.number}</span></Row>
                      {app.min_investment_azn && <Row label="Min. investisiya">{formatAzn(Number(app.min_investment_azn))}</Row>}
                      {app.outcome === "WON" && (
                        <Row label="EKTİS-ə ötürülmə">
                          <EktisDelivery applicationId={app.id} />
                        </Row>
                      )}
                    </dl>
                  </section>
                </div>
              )}
              {tab === "plan" && (
                <dl>
                  <Row label="Layihənin adı">{app.project_title ?? "—"}</Row>
                  <Row label="İnvestisiya">{plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"}</Row>
                  <Row label="Öz vəsaiti">{plan.own_funds_pct ? `${formatNumber(Number(plan.own_funds_pct))}%` : "—"}</Row>
                  <Row label="İş yerləri">{plan.jobs_planned ?? "—"}{plan.jobs_local != null && ` (yerli: ${plan.jobs_local})`}</Row>
                  <Row label="İcra müddəti">{plan.implementation_months ? `${plan.implementation_months} ay` : "—"}</Row>
                  <Row label="Təcrübə">{plan.experience_years != null ? `${plan.experience_years} il` : "—"}</Row>
                  <Row label="Qısa təsvir">{plan.summary ?? "—"}</Row>
                  <Row label="Məhsul və bazar">{plan.products_market ?? "—"}</Row>
                  <Row label="Texnologiya">{plan.technology ?? "—"}</Row>
                  <Row label="Suvarma">{plan.water_plan ?? "—"}</Row>
                </dl>
              )}
              {tab === "docs" && (
                <table className="w-full text-13">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="py-2 font-medium">Sənəd</th>
                      <th className="py-2 font-medium">Fayl</th>
                      <th className="py-2 text-right font-medium">Ölçü</th>
                      <th className="py-2 font-medium">Yüklənib</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {app.required_documents.map((d) => (
                      <tr key={d.code} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-3">
                          {d.name_az}
                          {!d.mandatory && <span className="text-ink-3"> (könüllü)</span>}
                        </td>
                        <td className="py-2 pr-3">
                          {d.document ? (
                            <a
                              href={`/api/v1/admin/applications/${app.id}/documents/${d.document.id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Download className="size-3.5" aria-hidden /> {d.document.original_name}
                            </a>
                          ) : (
                            <span className={d.mandatory ? "text-danger" : "text-ink-3"}>{d.mandatory ? "Yoxdur" : "—"}</span>
                          )}
                        </td>
                        <td className="py-2 text-right">{d.document ? formatSize(d.document.size_bytes) : ""}</td>
                        <td className="py-2 pl-3">{d.document ? formatDateTime(d.document.uploaded_at) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === "history" && <StatusTimeline items={app.history} />}
            </PanelBody>
          </Panel>
          {app.info_request && (
            <Panel className="mt-4">
              <PanelHeader>
                <PanelTitle>Əlavə məlumat sorğusu</PanelTitle>
              </PanelHeader>
              <PanelBody className="space-y-2 text-sm">
                <p>{app.info_request.message}</p>
                {app.info_request.responded_at ? (
                  <p className="rounded-md bg-status-won-bg px-3 py-2 text-status-won-fg">
                    Cavab ({formatDateTime(app.info_request.responded_at)}): {app.info_request.response_text}
                  </p>
                ) : (
                  <p className="text-ink-3">Cavab gözlənilir.</p>
                )}
              </PanelBody>
            </Panel>
          )}
        </div>
        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <ActionPanel app={app} />
        </div>
      </div>
    </div>
  );
}
