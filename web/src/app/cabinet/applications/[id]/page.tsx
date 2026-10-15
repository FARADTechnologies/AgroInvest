"use client";

import { BadgeCheck, CircleAlert, CircleX, Send } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/domain/status-badge";
import { StatusTimeline } from "@/components/domain/status-timeline";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import {
  type Application,
  useApplication,
  useInfoResponse,
  useUploadDocument
} from "@/features/applications/api";
import { DocumentSlot } from "@/features/applications/document-slot";
import { ApiError } from "@/lib/api/client";
import { useL, useT } from "@/lib/i18n";
import { formatAzn, formatDate, formatDateTime, formatHectares } from "@/lib/utils";

function InfoRequestPanel({ app }: { app: Application }) {
  const L = useL();
  const request = app.info_request!;
  const upload = useUploadDocument(app.id);
  const respond = useInfoResponse(app.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const requested = request.requested_docs as { code: string; name_az: string }[];
  const uploadedForRequest = new Set(
    app.documents.filter((d) => d.info_request_id === request.id).map((d) => d.doc_type_code)
  );
  const ready = requested.every((d) => uploadedForRequest.has(d.code)) && text.trim().length >= 3;

  return (
    <section className="overflow-hidden rounded-3xl border border-status-info-fg/30 bg-status-info-bg/60 shadow-card">
      <div className="flex items-start gap-3 border-b border-status-info-fg/20 px-4 py-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-info-fg" aria-hidden />
        <div>
          <h2 className="text-15 text-status-info-fg">{L("Əlavə məlumat tələb olunur", "More information requested")}</h2>
          <p className="mt-1 text-sm text-ink">{request.message}</p>
          <p className="mt-1 text-13 text-ink-3">{formatDateTime(request.created_at)}</p>
        </div>
      </div>
      {requested.length > 0 && (
        <ul className="divide-y divide-border bg-surface">
          {requested.map((d) => {
            const doc = app.documents.find((x) => x.doc_type_code === d.code && x.info_request_id === request.id);
            return (
              <DocumentSlot
                key={d.code}
                name={d.name_az}
                mandatory
                maxMb={10}
                document={doc}
                downloadHref={doc ? `/api/v1/applications/${app.id}/documents/${doc.id}` : undefined}
                editable
                highlight={!doc}
                busy={busy === d.code}
                onUpload={async (file) => {
                  setBusy(d.code);
                  try {
                    await upload.mutateAsync({ docType: d.code, file });
                  } finally {
                    setBusy(null);
                  }
                }}
              />
            );
          })}
        </ul>
      )}
      <div className="space-y-3 bg-surface p-4">
        <Textarea
          aria-label={L("Cavab", "Reply")}
          placeholder={L("Mütəxəssisə cavabınız", "Your reply to the specialist")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={3000}
        />
        <FormError message={respond.error instanceof ApiError ? respond.error.message : null} />
        <div className="flex justify-end">
          <Button
            disabled={!ready || respond.isPending}
            onClick={() =>
              respond.mutate(text, {
                onSuccess: () => toast.success(L("Cavab göndərildi, müraciət yenidən baxılmaya qaytarıldı", "Reply sent; the application is back in review"))
              })
            }
          >
            <Send /> {L("Cavabı göndər", "Send reply")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function DecisionBanner({ app }: { app: Application }) {
  const L = useL();
  const won = app.outcome === "WON";
  return (
    <section
      className={
        won
          ? "rounded-3xl border border-status-won-fg/30 bg-status-won-bg px-5 py-4"
          : "rounded-3xl border border-status-rejected-fg/30 bg-status-rejected-bg px-5 py-4"
      }
    >
      <div className="flex items-start gap-3">
        {won ? (
          <BadgeCheck className="mt-0.5 size-5 text-status-won-fg" aria-hidden />
        ) : (
          <CircleX className="mt-0.5 size-5 text-status-rejected-fg" aria-hidden />
        )}
        <div>
          <h2 className={won ? "text-15 text-status-won-fg" : "text-15 text-status-rejected-fg"}>
            {won ? L("Təbrik edirik: müsabiqənin qalibi oldunuz", "Congratulations: you won the competition") : L("Müraciət üzrə imtina qərarı verilib", "The application was rejected")}
          </h2>
          {app.decision_reason && <p className="mt-1 text-sm text-ink">{L("Səbəb", "Reason")}: {app.decision_reason}</p>}
          {app.decided_at && <p className="mt-1 text-13 text-ink-3">{formatDateTime(app.decided_at)}</p>}
          {won && (
            <p className="mt-2 text-sm text-ink-2">
              {L(
                "Qərar Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS) ötürülür. İcarə müqaviləsinin bağlanması üçün Nazirlik sizinlə əlaqə saxlayacaq.",
                "The decision is passed to the Electronic Agriculture Information System (EKTIS). The Ministry will contact you to sign the lease."
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CabinetApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const L = useL();
  const t = useT();
  const { data: app, isLoading, error } = useApplication(id);

  if (error) {
    return (
      <div className="py-16 text-center text-ink-2">
        {L("Müraciət tapılmadı.", "Application not found.")}{" "}
        <Link href="/cabinet" className="text-primary hover:underline">
          {L("Müraciətlərimə qayıt", "Back to my applications")}
        </Link>
      </div>
    );
  }
  if (isLoading || !app) return <Skeleton className="h-96" />;

  const plan = app.business_plan;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cabinet" className="text-13 font-medium text-ink-3 hover:text-ink">← {L("Ümumi baxış", "Overview")}</Link>
          <h1 className="mt-1 font-mono text-3xl font-medium tracking-tight">{app.number ?? L("Qaralama", "Draft")}</h1>
          <div className="mt-1 text-sm text-ink-2">
            {app.area.code} · {app.area.name_az} · {app.competition.number}
          </div>
        </div>
        <StatusBadge status={app.status} outcome={app.outcome} className="text-sm" />
      </header>

      {app.status === "INFO_REQUESTED" && app.info_request && !app.info_request.responded_at && (
        <InfoRequestPanel app={app} />
      )}
      {app.status === "DECIDED" && <DecisionBanner app={app} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Layihə", "Project")}</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-2 text-sm sm:grid-cols-3">
              {(
                [
                  [L("Sahə", "Plot"), `${app.area.rayon_name}, ${formatHectares(Number(app.area.area_ha))}`],
                  [L("Fəaliyyət", "Activity"), t.purpose[app.activity]],
                  [L("İnvestisiya", "Investment"), plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"],
                  [L("İş yerləri", "Jobs"), plan.jobs_planned ?? "—"],
                  [L("İcra müddəti", "Duration"), plan.implementation_months ? `${plan.implementation_months} ${L("ay", "months")}` : "—"],
                  [L("Göndərilib", "Submitted"), app.submitted_at ? formatDate(app.submitted_at) : "—"]
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-2/70 px-3.5 py-2.5">
                  <div className="text-2xs font-medium text-ink-3">{k}</div>
                  <div className="mt-0.5 font-semibold tabular">{v}</div>
                </div>
              ))}
              {plan.summary && <p className="pt-2 text-ink-2 sm:col-span-3">{plan.summary}</p>}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>{L("Sənədlər", "Documents")}</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-border/60">
              {app.documents.map((d) => (
                <DocumentSlot
                  key={d.id}
                  name={d.doc_type_name}
                  mandatory
                  maxMb={10}
                  document={d}
                  downloadHref={`/api/v1/applications/${app.id}/documents/${d.id}`}
                  editable={false}
                />
              ))}
            </ul>
          </Panel>
        </div>
        <Panel className="self-start">
          <PanelHeader>
            <PanelTitle>{L("Müraciət tarixçəsi", "History")}</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <StatusTimeline items={app.history} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
