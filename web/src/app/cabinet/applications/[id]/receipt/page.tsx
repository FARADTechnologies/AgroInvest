"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { useApplication } from "@/features/applications/api";
import { useT } from "@/lib/i18n";
import { formatAzn, formatDateTime, formatHectares } from "@/lib/utils";

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4 border-b border-border py-2 last:border-b-0 print:grid-cols-[170px_minmax(0,1fr)]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}

/**
 * Receipt (arayış) that the application was registered. Printed or saved as PDF from
 * the browser, so it uses the portal's own font and renders every Azerbaijani letter.
 */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const { data: app, isLoading, error } = useApplication(id);

  if (error) return <div className="py-16 text-center text-ink-2">Müraciət tapılmadı.</div>;
  if (isLoading || !app) return <Skeleton className="h-96" />;
  if (!app.number || !app.submitted_at) {
    return <div className="py-16 text-center text-ink-2">Arayış müraciət göndərildikdən sonra yaradılır.</div>;
  }

  const a = app.applicant;
  const plan = app.business_plan;
  const docs = [...new Map(app.documents.map((d) => [d.doc_type_code, d])).values()];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/cabinet/applications/${app.id}`} className="text-13 text-primary hover:underline">
          ← Müraciətə qayıt
        </Link>
        <Button onClick={() => window.print()}>
          <Printer /> Çap et və ya PDF kimi saxla
        </Button>
      </div>

      <article className="rounded-md border border-border bg-surface px-8 py-7 text-sm print:border-0 print:px-0 print:py-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-primary pb-4">
          <div>
            <div className="text-13 font-medium uppercase tracking-wide text-primary">Agro Invest</div>
            <h1 className="mt-1 text-xl">Müraciətin qeydiyyatı haqqında arayış</h1>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-medium">{app.number}</div>
            <div className="text-13 text-ink-3">{formatDateTime(app.submitted_at)}</div>
          </div>
        </header>

        <p className="mt-4 text-ink-2">
          Aşağıda göstərilən investisiya müraciəti elektron qaydada qəbul edilib və qeydiyyata alınıb. Müraciətin
          vəziyyətini portalda “Şəxsi kabinet” bölməsində izləyə bilərsiniz.
        </p>

        <h2 className="mt-5 text-13 font-medium uppercase tracking-wide text-ink-3">Ərizəçi</h2>
        <dl className="mt-1">
          <Line label="Ad">{a?.display_name}</Line>
          <Line label="Növ">{a?.type === "COMPANY" ? "Hüquqi şəxs" : "Fiziki şəxs"}</Line>
          {a && (
            <Line label={a.identifier_label}>
              <span className="font-mono">{a.identifier}</span>
            </Line>
          )}
          {a?.ektis_farmer_id && (
            <Line label="EKTİS fermer">
              <span className="font-mono">{a.ektis_farmer_id}</span>
            </Line>
          )}
        </dl>

        <h2 className="mt-5 text-13 font-medium uppercase tracking-wide text-ink-3">Müsabiqə və sahə</h2>
        <dl className="mt-1">
          <Line label="Müsabiqə">
            <span className="font-mono">{app.competition.number}</span> · {app.competition.title_az}
          </Line>
          <Line label="Sahə">
            <span className="font-mono">{app.area.code}</span> · {app.area.name_az}
          </Line>
          <Line label="Yerləşdiyi ərazi">
            {app.area.rayon_name} rayonu · {formatHectares(Number(app.area.area_ha))}
          </Line>
          <Line label="Fəaliyyət">{t.purpose[app.activity]}</Line>
          {app.project_title && <Line label="Layihə">{app.project_title}</Line>}
          {plan.investment_azn && <Line label="Planlaşdırılan investisiya">{formatAzn(Number(plan.investment_azn))}</Line>}
          {plan.jobs_planned != null && <Line label="Yeni iş yerləri">{plan.jobs_planned}</Line>}
        </dl>

        <h2 className="mt-5 text-13 font-medium uppercase tracking-wide text-ink-3">Təqdim edilmiş sənədlər</h2>
        <ul className="mt-1 list-disc pl-5">
          {docs.map((d) => (
            <li key={d.doc_type_code}>{d.doc_type_name}</li>
          ))}
        </ul>

        <footer className="mt-6 border-t border-border pt-3 text-13 text-ink-3">
          Status: {t.status[app.status]}. Arayış portal tərəfindən avtomatik yaradılıb ({formatDateTime(new Date().toISOString())})
          və imza tələb etmir. Prototip: rəsmi sənəd deyil.
        </footer>
      </article>
    </div>
  );
}
