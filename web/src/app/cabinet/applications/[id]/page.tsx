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
import { useT } from "@/lib/i18n";
import { formatAzn, formatDate, formatDateTime, formatHectares } from "@/lib/utils";

function InfoRequestPanel({ app }: { app: Application }) {
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
    <section className="rounded-md border border-status-info-fg/40 bg-status-info-bg/50">
      <div className="flex items-start gap-3 border-b border-status-info-fg/20 px-4 py-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-info-fg" aria-hidden />
        <div>
          <h2 className="text-15 text-status-info-fg">Əlavə məlumat tələb olunur</h2>
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
          aria-label="Cavab"
          placeholder="Mütəxəssisə cavabınız"
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
                onSuccess: () => toast.success("Cavab göndərildi, müraciət yenidən baxılmaya qaytarıldı")
              })
            }
          >
            <Send /> Cavabı göndər
          </Button>
        </div>
      </div>
    </section>
  );
}

function DecisionBanner({ app }: { app: Application }) {
  const won = app.outcome === "WON";
  return (
    <section
      className={
        won
          ? "rounded-md border border-status-won-fg/30 bg-status-won-bg px-4 py-3"
          : "rounded-md border border-status-rejected-fg/30 bg-status-rejected-bg px-4 py-3"
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
            {won ? "Təbrik edirik: müsabiqənin qalibi oldunuz" : "Müraciət üzrə imtina qərarı verilib"}
          </h2>
          {app.decision_reason && <p className="mt-1 text-sm text-ink">Səbəb: {app.decision_reason}</p>}
          {app.decided_at && <p className="mt-1 text-13 text-ink-3">{formatDateTime(app.decided_at)}</p>}
          {won && (
            <p className="mt-2 text-sm text-ink-2">
              Qərar Elektron Kənd Təsərrüfatı İnformasiya Sisteminə (EKTİS) ötürülür. İcarə müqaviləsinin bağlanması
              üçün Nazirlik sizinlə əlaqə saxlayacaq.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CabinetApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data: app, isLoading, error } = useApplication(id);

  if (error) {
    return (
      <div className="py-16 text-center text-ink-2">
        Müraciət tapılmadı.{" "}
        <Link href="/cabinet" className="text-primary hover:underline">
          Müraciətlərimə qayıt
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
          <div className="text-13 text-ink-3">Müraciət</div>
          <h1 className="font-mono text-2xl font-medium tracking-tight">{app.number ?? "Qaralama"}</h1>
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
              <PanelTitle>Layihə</PanelTitle>
            </PanelHeader>
            <PanelBody className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><span className="text-ink-3">Sahə:</span> {app.area.rayon_name}, {formatHectares(Number(app.area.area_ha))}</div>
              <div><span className="text-ink-3">Fəaliyyət:</span> {t.purpose[app.activity]}</div>
              <div><span className="text-ink-3">İnvestisiya:</span> {plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"}</div>
              <div><span className="text-ink-3">İş yerləri:</span> {plan.jobs_planned ?? "—"}</div>
              <div><span className="text-ink-3">İcra müddəti:</span> {plan.implementation_months ? `${plan.implementation_months} ay` : "—"}</div>
              <div><span className="text-ink-3">Göndərilib:</span> {app.submitted_at ? formatDate(app.submitted_at) : "—"}</div>
              {plan.summary && <p className="text-ink-2 sm:col-span-2">{plan.summary}</p>}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader>
              <PanelTitle>Sənədlər</PanelTitle>
            </PanelHeader>
            <ul className="divide-y divide-border">
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
            <PanelTitle>Müraciət tarixçəsi</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <StatusTimeline items={app.history} />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
