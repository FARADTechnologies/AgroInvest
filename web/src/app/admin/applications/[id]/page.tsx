"use client";

import { ChevronRight, Download, EyeOff, Lock } from "lucide-react";
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
import { type Application, type ApplicationStatus, useAdminApplication, useTransition } from "@/features/applications/api";
import { formatSize } from "@/features/applications/document-slot";
import { ApiError } from "@/lib/api/client";
import { useL, useLang, useT } from "@/lib/i18n";
import { cn, daysUntil, formatAzn, formatDate, formatDateTime, formatHectares, formatNumber } from "@/lib/utils";

const ACTION_LABEL: Record<string, { title: string; hint: string }> = {
  UNDER_REVIEW: { title: "Baxılmağa götür", hint: "Status “Baxılır” olur, sahibkar bildiriş alır" },
  INFO_REQUESTED: { title: "Əlavə məlumat tələb et", hint: "Səbəb və lazım olan sənədlər sahibkara göndərilir" },
  DECIDED: { title: "Qərar ver", hint: "Yekun qərar: Qalib və ya İmtina, səbəb göstərilməklə" }
};

const ACTION_LABEL_EN: Record<string, { title: string; hint: string }> = {
  UNDER_REVIEW: { title: "Take into review", hint: "Status becomes “Under review”; the applicant is notified" },
  INFO_REQUESTED: { title: "Request more information", hint: "The reason and the documents needed are sent to the applicant" },
  DECIDED: { title: "Decide", hint: "Final decision: Winner or Rejected, with a reason" }
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
  const L = useL();
  const { lang } = useLang();
  const actions = lang === "en" ? ACTION_LABEL_EN : ACTION_LABEL;
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
            {app.status === "DECIDED" ? L("Qərar yekundur", "The decision is final") : waiting ? L("Sahibkarın cavabı gözlənilir", "Waiting for the applicant") : L("Əməliyyat yoxdur", "No actions")}
          </div>
          <p className="text-ink-2">
            {app.status === "DECIDED"
              ? L("Verilmiş qərar dəyişdirilə bilməz; bütün addımlar tarixçədə qeydə alınıb.", "A decision cannot be changed; every step is recorded in the history.")
              : waiting
                ? L("Sahibkar tələb olunan məlumatı göndərdikdə müraciət avtomatik olaraq “Baxılır” statusuna qayıdacaq.", "Once the applicant sends the requested information, the application returns to “Under review” automatically.")
                : L("Sizin rolunuz bu müraciətə yalnız baxış hüququ verir.", "Your role can only view this application.")}
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
          toast.success(`${L("Status dəyişdirildi", "Status changed")}: ${t.status[a.status]}`);
        },
        onError: () => setConfirming(false)
      }
    );

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{L("Növbəti addım", "Next step")}</PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="space-y-1.5" role="radiogroup" aria-label={L("Əməliyyat", "Action")}>
          {app.allowed_transitions.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={to === s}
              onClick={() => setTo(s)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2 text-left",
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
                <span className="block text-sm font-medium">{actions[s].title}</span>
                <span className="block text-13 text-ink-3">{actions[s].hint}</span>
              </span>
            </button>
          ))}
        </div>

        {to === "DECIDED" && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={L("Nəticə", "Outcome")}>
            {(["WON", "REJECTED"] as const).map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={outcome === o}
                onClick={() => setOutcome(o)}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm font-medium",
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
            <legend className="mb-1 text-13 font-medium text-ink-2">{L("Tələb olunan sənədlər (könüllü)", "Documents to request (optional)")}</legend>
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
            {L("Səbəb", "Reason")}{needsReason && <span className="text-danger"> *</span>}
          </label>
          <Textarea
            id="reason"
            className="mt-1.5"
            value={reason}
            maxLength={3000}
            onChange={(e) => setReason(e.target.value)}
            placeholder={needsReason ? L("Sahibkara göstəriləcək səbəb", "Reason shown to the applicant") : L("Könüllü qeyd", "Optional note")}
          />
          <p className="mt-1 text-13 text-ink-3">{L("Səbəb sahibkarın tarixçəsində görünür.", "The reason appears in the applicant's history.")}</p>
        </div>

        <FormError message={transition.error instanceof ApiError ? transition.error.message : null} />
        <Button
          className="w-full"
          disabled={!ready || transition.isPending}
          onClick={() => (to === "DECIDED" ? setConfirming(true) : send())}
        >
          {L("Təsdiq et", "Confirm")}
        </Button>

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent
            title={`${L("Qərar", "Decision")}: ${outcome ? t.outcome[outcome] : ""}`}
            description={L("Qərar yekundur, sahibkara bildiriş göndəriləcək və nəticə EKTİS-ə ötürüləcək.", "The decision is final; the applicant will be notified and the result passed to EKTIS.")}
          >
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">{reason}</p>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">{L("Ləğv et", "Cancel")}</Button>
              </DialogClose>
              <Button variant={outcome === "REJECTED" ? "danger" : "primary"} disabled={transition.isPending} onClick={send}>
                {L("Qərarı təsdiq et", "Confirm decision")}
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
  const L = useL();
  const { data: app, isLoading, error } = useAdminApplication(id);
  const [tab, setTab] = useState<"general" | "plan" | "docs" | "history">("general");

  if (error) return <div className="py-16 text-center text-ink-2">{L("Müraciət tapılmadı.", "Application not found.")}</div>;
  if (isLoading || !app) return <Skeleton className="h-96" />;

  const a = app.applicant;
  const plan = app.business_plan;
  const mandatory = app.required_documents.filter((d) => d.mandatory);
  const attached = mandatory.filter((d) => d.document).length;
  const tabs = [
    ["general", L("Ümumi", "General")],
    ["plan", L("Biznes plan", "Business plan")],
    ["docs", `${L("Sənədlər", "Documents")} ${attached}/${mandatory.length}`],
    ["history", L("Tarixçə", "History")]
  ] as const;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/applications" className="hover:text-ink">{L("Müraciətlər", "Applications")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{app.number}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-border/70 bg-surface shadow-card px-4 py-3">
        <span className="font-mono text-lg font-medium">{app.number}</span>
        <StatusBadge status={app.status} outcome={app.outcome} />
        <span className="text-sm text-ink">{a?.display_name}</span>
        {a && (
          <span className="inline-flex items-center gap-1 font-mono text-13 text-ink-2" title={L("Maskalanıb", "Masked")}>
            {a.identifier_label} {a.identifier}
            <EyeOff className="size-3.5 text-ink-3" aria-label={L("maskalanıb", "masked")} />
          </span>
        )}
        <span className="ml-auto text-13 text-ink-3">
          {L("Daxil olub", "Received")}: {app.submitted_at ? `${formatDate(app.submitted_at)} (${Math.max(0, -daysUntil(app.submitted_at) + 1)} ${L("gün", "days")})` : "—"}
        </span>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl bg-surface p-1 shadow-card" role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm transition-colors",
                  tab === key ? "bg-primary font-medium text-primary-fg" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
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
                    <h2 className="mb-1 text-13 font-medium uppercase tracking-wide text-ink-3">{L("Sahibkar", "Applicant")}</h2>
                    <dl>
                      <Row label={L("Növ", "Type")}>{a?.type === "COMPANY" ? L("Hüquqi şəxs", "Company") : L("Fiziki şəxs", "Individual")}</Row>
                      <Row label={L("Ad", "Name")}>{a?.display_name}</Row>
                      {a?.company_name && <Row label={L("Nümayəndə", "Representative")}>{a.full_name}</Row>}
                      <Row label={a?.identifier_label ?? "FİN"}><span className="font-mono">{a?.identifier}</span></Row>
                      <Row label={L("Telefon", "Phone")}>{a?.phone}</Row>
                      <Row label={L("E-poçt", "E-mail")}>{a?.email}</Row>
                      {a?.address && <Row label={L("Ünvan", "Address")}>{a.address}</Row>}
                      <Row label={L("Yerli sahibkar", "Local applicant")}>{a?.is_local ? `${L("Bəli", "Yes")}${a.origin_rayon_name ? ` · ${a.origin_rayon_name}` : ""}` : L("Xeyr", "No")}</Row>
                    </dl>
                  </section>
                  <section>
                    <h2 className="mb-1 text-13 font-medium uppercase tracking-wide text-ink-3">{L("Sahə və müsabiqə", "Plot and competition")}</h2>
                    <dl>
                      <Row label={L("Sahə", "Plot")}>
                        <Link href={`/areas/${app.area.code}`} className="font-mono text-primary hover:underline">{app.area.code}</Link>{" "}
                        {app.area.name_az}
                      </Row>
                      <Row label={L("Rayon", "District")}>{app.area.rayon_name}</Row>
                      <Row label={L("Ölçü", "Size")}>{formatHectares(Number(app.area.area_ha))}</Row>
                      <Row label={L("Təyinat", "Purpose")}><PurposeChip purpose={app.area.purpose} /></Row>
                      <Row label={L("Fəaliyyət", "Activity")}>{t.purpose[app.activity]}</Row>
                      <Row label={L("Müsabiqə", "Competition")}><span className="font-mono">{app.competition.number}</span></Row>
                      {app.min_investment_azn && <Row label={L("Min. investisiya", "Min. investment")}>{formatAzn(Number(app.min_investment_azn))}</Row>}
                    </dl>
                  </section>
                </div>
              )}
              {tab === "plan" && (
                <dl>
                  <Row label={L("Layihənin adı", "Project title")}>{app.project_title ?? "—"}</Row>
                  <Row label={L("İnvestisiya", "Investment")}>{plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"}</Row>
                  <Row label={L("Öz vəsaiti", "Own funds")}>{plan.own_funds_pct ? `${formatNumber(Number(plan.own_funds_pct))}%` : "—"}</Row>
                  <Row label={L("İş yerləri", "Jobs")}>{plan.jobs_planned ?? "—"}{plan.jobs_local != null && ` (${L("yerli", "local")}: ${plan.jobs_local})`}</Row>
                  <Row label={L("İcra müddəti", "Duration")}>{plan.implementation_months ? `${plan.implementation_months} ${L("ay", "months")}` : "—"}</Row>
                  <Row label={L("Təcrübə", "Experience")}>{plan.experience_years != null ? `${plan.experience_years} ${L("il", "years")}` : "—"}</Row>
                  <Row label={L("Qısa təsvir", "Summary")}>{plan.summary ?? "—"}</Row>
                  <Row label={L("Məhsul və bazar", "Products and market")}>{plan.products_market ?? "—"}</Row>
                  <Row label={L("Texnologiya", "Technology")}>{plan.technology ?? "—"}</Row>
                  <Row label={L("Suvarma", "Irrigation")}>{plan.water_plan ?? "—"}</Row>
                </dl>
              )}
              {tab === "docs" && (
                <table className="w-full text-13">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-3">
                      <th className="py-2 font-medium">{L("Sənəd", "Document")}</th>
                      <th className="py-2 font-medium">{L("Fayl", "File")}</th>
                      <th className="py-2 text-right font-medium">{L("Ölçü", "Size")}</th>
                      <th className="py-2 font-medium">{L("Yüklənib", "Uploaded")}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    {app.required_documents.map((d) => (
                      <tr key={d.code} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-3">
                          {d.name_az}
                          {!d.mandatory && <span className="text-ink-3"> ({L("könüllü", "optional")})</span>}
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
                            <span className={d.mandatory ? "text-danger" : "text-ink-3"}>{d.mandatory ? L("Yoxdur", "Missing") : "—"}</span>
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
                <PanelTitle>{L("Əlavə məlumat sorğusu", "Information request")}</PanelTitle>
              </PanelHeader>
              <PanelBody className="space-y-2 text-sm">
                <p>{app.info_request.message}</p>
                {app.info_request.responded_at ? (
                  <p className="rounded-xl bg-status-won-bg px-3 py-2 text-status-won-fg">
                    {L("Cavab", "Reply")} ({formatDateTime(app.info_request.responded_at)}): {app.info_request.response_text}
                  </p>
                ) : (
                  <p className="text-ink-3">{L("Cavab gözlənilir.", "Waiting for a reply.")}</p>
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
