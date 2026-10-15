"use client";

import { Check, CircleAlert, CircleCheck, Clock, FileCheck2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DeadlineBadge } from "@/components/domain/deadline";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { StatusBadge } from "@/components/domain/status-badge";
import { RequireRole } from "@/components/layout/require-role";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import {
  type Application,
  type BusinessPlanInput,
  useApplication,
  useCreateDraft,
  useProfile,
  useRemoveDocument,
  useSubmit,
  useUpdateDraft,
  useUploadDocument
} from "@/features/applications/api";
import { DocumentSlot } from "@/features/applications/document-slot";
import { ProfileForm } from "@/features/applications/profile-form";
import { EktisCheck } from "@/features/integration/ektis-check";
import { useArea } from "@/features/areas/api";
import { ApiError } from "@/lib/api/client";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { useT } from "@/lib/i18n";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

const STEPS = ["Sahibkar", "Sahə və fəaliyyət", "İnvestisiya və biznes plan", "Sənədlər", "Yoxla və göndər"];

function Stepper({ step, done, onGo }: { step: number; done: boolean[]; onGo: (i: number) => void }) {
  return (
    <ol className="flex gap-1 overflow-x-auto md:flex-col md:gap-0">
      {STEPS.map((label, i) => {
        const active = i === step;
        const reachable = i <= step || done[i - 1];
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm whitespace-nowrap disabled:cursor-not-allowed",
                active ? "bg-primary-50 font-medium text-primary" : "text-ink-2 hover:bg-surface-2 disabled:hover:bg-transparent"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-13 tabular",
                  done[i] && !active
                    ? "border-status-won-fg bg-status-won-bg text-status-won-fg"
                    : active
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border-strong text-ink-3"
                )}
              >
                {done[i] && !active ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="hidden md:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SummaryAside({ app, areaCode }: { app: Application | undefined; areaCode: string }) {
  const { data: area } = useArea(areaCode);
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <Panel>
        <PanelBody className="space-y-3 text-sm">
          <div className="font-mono text-13 text-ink-3">{areaCode}</div>
          <div className="font-medium">{area?.name_az ?? "…"}</div>
          {area && (
            <div className="flex flex-wrap gap-2">
              <PurposeChip purpose={area.purpose} />
              <span className="tabular text-13 text-ink-2">{formatHectares(Number(area.area_ha))}</span>
            </div>
          )}
          {area?.competition && (
            <div className="rounded-md bg-surface-2 px-3 py-2 text-13">
              <div className="font-mono text-ink-2">{area.competition.number}</div>
              <div className="flex items-center justify-between gap-2">
                <span>Son tarix: {formatDate(area.competition.deadline_at)}</span>
                <DeadlineBadge iso={area.competition.deadline_at} />
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
      {app && (
        <Panel>
          <PanelBody className="space-y-2 text-sm">
            <div className="text-13 font-medium text-ink-2">Tamlıq</div>
            {(
              [
                ["Sahibkar məlumatları", app.completeness.profile],
                ["Biznes plan", app.completeness.business_plan],
                ["Sənədlər", app.completeness.documents]
              ] as const
            ).map(([label, ok]) => (
              <div key={label} className="flex items-center gap-2">
                {ok ? (
                  <CircleCheck className="size-4 text-status-won-fg" aria-hidden />
                ) : (
                  <span className="size-4 rounded-full border-2 border-border-strong" aria-hidden />
                )}
                <span className={ok ? "text-ink" : "text-ink-2"}>{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1 text-13 text-ink-3">
              <Clock className="size-3.5" aria-hidden /> Qaralama avtomatik yadda saxlanılır
            </div>
          </PanelBody>
        </Panel>
      )}
    </aside>
  );
}

function ActivityStep({ app, onNext }: { app: Application; onNext: () => void }) {
  const t = useT();
  const update = useUpdateDraft(app.id);
  const [activity, setActivity] = useState<Purpose>(app.activity);
  const [title, setTitle] = useState(app.project_title ?? "");
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-surface-2/60 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-13 text-ink-3">{app.area.code}</div>
            <div className="font-medium">{app.area.name_az}</div>
            <div className="text-ink-2">
              {app.area.village_name ? `${app.area.village_name}, ` : ""}
              {app.area.rayon_name} · {formatHectares(Number(app.area.area_ha))}
            </div>
          </div>
          <PurposeChip purpose={app.area.purpose} />
        </div>
        <div className="mt-3 border-t border-border pt-3 text-ink-2">
          Müsabiqə: <span className="font-mono text-ink">{app.competition.number}</span> · {app.competition.title_az}
          {app.min_investment_azn && <div>Minimum investisiya: {formatAzn(Number(app.min_investment_azn))}</div>}
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-13 font-medium text-ink-2">Planlaşdırılan fəaliyyət</legend>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <PurposeChip key={p} purpose={p} selected={activity === p} onToggle={() => setActivity(p)} />
          ))}
        </div>
        {activity !== app.area.purpose && (
          <p className="mt-2 text-13 text-status-info-fg">
            Seçilmiş fəaliyyət sahənin təyinatından ({t.purpose[app.area.purpose]}) fərqlidir; komissiya bunu nəzərə alacaq.
          </p>
        )}
      </fieldset>
      <Field id="project_title" label="Layihənin adı" hint="Məsələn: Damcı suvarma ilə intensiv alma bağı">
        <Input id="project_title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button
          disabled={update.isPending}
          onClick={() => update.mutate({ activity, project_title: title }, { onSuccess: onNext })}
        >
          Davam et
        </Button>
      </div>
    </div>
  );
}

type PlanForm = Record<keyof BusinessPlanInput, string>;
const PLAN_FIELDS: (keyof BusinessPlanInput)[] = [
  "investment_azn", "own_funds_pct", "jobs_planned", "jobs_local", "implementation_months",
  "experience_years", "summary", "products_market", "technology", "water_plan"
];
const NUMERIC = new Set(["investment_azn", "own_funds_pct", "jobs_planned", "jobs_local", "implementation_months", "experience_years"]);

function PlanStep({ app, onNext }: { app: Application; onNext: () => void }) {
  const update = useUpdateDraft(app.id);
  const [form, setForm] = useState<PlanForm>(() =>
    Object.fromEntries(PLAN_FIELDS.map((k) => [k, app.business_plan[k] != null ? String(app.business_plan[k]) : ""])) as PlanForm
  );
  const set = (k: keyof BusinessPlanInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = update.error instanceof ApiError ? update.error : null;
  const fe = (k: string) => err?.forField(k);
  const investment = Number(form.investment_azn || 0);
  const minInv = app.min_investment_azn ? Number(app.min_investment_azn) : null;

  const save = () => {
    const payload = Object.fromEntries(
      PLAN_FIELDS.map((k) => {
        const v = form[k].trim();
        if (!v) return [k, null];
        return [k, NUMERIC.has(k) ? (k.endsWith("azn") || k.endsWith("pct") ? v.replace(",", ".") : Number(v)) : v];
      })
    ) as BusinessPlanInput;
    update.mutate({ business_plan: payload }, { onSuccess: onNext });
  };

  return (
    <div className="space-y-5">
      <FormError message={err && err.fieldErrors.length === 0 ? err.message : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="investment_azn"
          label="İnvestisiya məbləği (AZN)"
          required
          error={fe("investment_azn")}
          hint={minInv ? `Minimum: ${formatAzn(minInv)}` : undefined}
        >
          <Input id="investment_azn" inputMode="decimal" className="tabular" value={form.investment_azn} onChange={set("investment_azn")} />
        </Field>
        <Field id="own_funds_pct" label="Öz vəsaitinin payı (%)" error={fe("own_funds_pct")}>
          <Input id="own_funds_pct" inputMode="decimal" className="tabular" value={form.own_funds_pct} onChange={set("own_funds_pct")} />
        </Field>
        <Field id="jobs_planned" label="Yeni iş yerləri" required error={fe("jobs_planned")}>
          <Input id="jobs_planned" inputMode="numeric" className="tabular" value={form.jobs_planned} onChange={set("jobs_planned")} />
        </Field>
        <Field id="jobs_local" label="Onlardan yerli sakinlər üçün" error={fe("jobs_local")}>
          <Input id="jobs_local" inputMode="numeric" className="tabular" value={form.jobs_local} onChange={set("jobs_local")} />
        </Field>
        <Field id="implementation_months" label="İcra müddəti (ay)" required error={fe("implementation_months")}>
          <Input id="implementation_months" inputMode="numeric" className="tabular" value={form.implementation_months} onChange={set("implementation_months")} />
        </Field>
        <Field id="experience_years" label="Sahədə təcrübə (il)" error={fe("experience_years")}>
          <Input id="experience_years" inputMode="numeric" className="tabular" value={form.experience_years} onChange={set("experience_years")} />
        </Field>
      </div>
      {minInv && investment > 0 && investment < minInv && (
        <p className="flex items-center gap-1.5 text-13 text-status-info-fg">
          <CircleAlert className="size-3.5" aria-hidden />
          Məbləğ müsabiqə üzrə minimum investisiyadan ({formatAzn(minInv)}) azdır.
        </p>
      )}
      <Field id="summary" label="Layihənin qısa təsviri" required error={fe("summary")} hint={`${form.summary.length}/3000`}>
        <Textarea id="summary" maxLength={3000} value={form.summary} onChange={set("summary")} placeholder="Nə istehsal ediləcək, hansı həcmdə, hansı texnologiya ilə" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="products_market" label="Məhsul və satış bazarı">
          <Textarea id="products_market" maxLength={3000} value={form.products_market} onChange={set("products_market")} />
        </Field>
        <Field id="water_plan" label="Suvarma və su təchizatı">
          <Textarea id="water_plan" maxLength={3000} value={form.water_plan} onChange={set("water_plan")} />
        </Field>
      </div>
      <Field id="technology" label="Texnologiya və avadanlıq">
        <Textarea id="technology" maxLength={3000} value={form.technology} onChange={set("technology")} />
      </Field>
      <div className="flex justify-end">
        <Button disabled={update.isPending} onClick={save}>
          Davam et
        </Button>
      </div>
    </div>
  );
}

function DocumentsStep({ app, onNext }: { app: Application; onNext: () => void }) {
  const upload = useUploadDocument(app.id);
  const remove = useRemoveDocument(app.id);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        PDF, JPG, PNG, DOCX və ya XLSX. Faylın növü məzmununa görə yoxlanılır; sənəd şifrəli serverdə saxlanılır.
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {app.required_documents.map((d) => (
          <DocumentSlot
            key={d.code}
            name={d.name_az}
            description={d.description_az}
            mandatory={d.mandatory}
            maxMb={d.max_mb}
            document={d.document}
            downloadHref={d.document ? `/api/v1/applications/${app.id}/documents/${d.document.id}` : undefined}
            editable
            busy={busy === d.code}
            onUpload={async (file) => {
              setBusy(d.code);
              try {
                await upload.mutateAsync({ docType: d.code, file });
              } finally {
                setBusy(null);
              }
            }}
            onRemove={d.document ? () => remove.mutateAsync(d.document!.id) : undefined}
          />
        ))}
      </ul>
      <div className="flex justify-end">
        <Button onClick={onNext}>Davam et</Button>
      </div>
    </div>
  );
}

function ReviewStep({ app, onSubmitted }: { app: Application; onSubmitted: (a: Application) => void }) {
  const t = useT();
  const submit = useSubmit(app.id);
  const [confirmed, setConfirmed] = useState(false);
  const plan = app.business_plan;
  const missing = app.completeness.missing;
  const rows: [string, React.ReactNode][] = [
    ["Müraciət edən", app.applicant ? `${app.applicant.display_name} · ${app.applicant.identifier_label} ${app.applicant.identifier}` : "—"],
    ["Sahə", `${app.area.code} · ${app.area.name_az}`],
    ["Müsabiqə", app.competition.number],
    ["Fəaliyyət", t.purpose[app.activity]],
    ["İnvestisiya", plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"],
    ["İş yerləri", plan.jobs_planned != null ? formatNumber(plan.jobs_planned) : "—"],
    ["İcra müddəti", plan.implementation_months ? `${plan.implementation_months} ay` : "—"],
    ["Sənədlər", `${app.documents.length} fayl`]
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-border rounded-md border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-2 text-sm">
            <dt className="text-ink-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 ? (
        <div role="alert" className="rounded-md border border-status-info-fg/30 bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
          <div className="font-medium">Göndərmək üçün tamamlayın:</div>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
          Təqdim etdiyim məlumatların və sənədlərin doğruluğunu təsdiq edirəm. Yanlış məlumat müraciətin rədd
          edilməsinə səbəb ola bilər.
        </label>
      )}
      <FormError message={submit.error instanceof ApiError ? submit.error.message : null} />
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={missing.length > 0 || !confirmed || submit.isPending}
          onClick={() => submit.mutate(undefined, { onSuccess: onSubmitted })}
        >
          <FileCheck2 /> {submit.isPending ? "Göndərilir…" : "Müraciəti göndər"}
        </Button>
      </div>
    </div>
  );
}

function Submitted({ app }: { app: Application }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <CircleCheck className="mx-auto size-12 text-status-won-fg" aria-hidden />
      <h1 className="mt-4 text-2xl">Müraciətiniz qəbul edildi</h1>
      <p className="mt-2 text-ink-2">Müraciət nömrəsi</p>
      <div className="mt-1 font-mono text-3xl font-medium tracking-tight text-ink">{app.number}</div>
      <div className="mt-3 flex justify-center">
        <StatusBadge status={app.status} />
      </div>
      <p className="mt-4 text-sm text-ink-2">
        Status dəyişdikcə bildiriş alacaqsınız. Müraciətin bütün tarixçəsi şəxsi kabinetdə görünür.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild>
          <Link href={`/cabinet/applications/${app.id}`}>Müraciəti izlə</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/cabinet/applications/${app.id}/receipt`}>Arayış (çap / PDF)</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/map">Xəritəyə qayıt</Link>
        </Button>
      </div>
    </div>
  );
}

function Wizard() {
  const params = useSearchParams();
  const router = useRouter();
  const areaCode = (params.get("area") ?? "").toUpperCase();
  const [appId, setAppId] = useState<string | null>(params.get("id"));
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: app } = useApplication(appId);
  const createDraft = useCreateDraft();
  const [step, setStep] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<Application | null>(null);
  const code = app?.area.code ?? areaCode;

  // Resume where the applicant left off.
  useEffect(() => {
    if (step !== null || profileLoading) return;
    if (!profile) return setStep(0);
    if (appId && !app) return;
    if (!app) return setStep(0);
    if (!app.completeness.business_plan) return setStep(app.project_title ? 2 : 1);
    if (!app.completeness.documents) return setStep(3);
    setStep(4);
  }, [step, profile, profileLoading, app, appId]);

  useEffect(() => {
    if (app && app.status !== "DRAFT" && !submitted) router.replace(`/cabinet/applications/${app.id}`);
  }, [app, submitted, router]);

  const done = useMemo(
    () => [
      !!profile && !!app,
      !!app?.project_title || (!!app && step !== null && step > 1),
      !!app?.completeness.business_plan,
      !!app?.completeness.documents,
      false
    ],
    [profile, app, step]
  );

  if (submitted) return <Submitted app={submitted} />;
  if (!code) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-ink-2">
        Müraciət etmək üçün əvvəlcə xəritədə və ya kataloqda sahə seçin.
        <div className="mt-4">
          <Button asChild variant="secondary">
            <Link href="/catalogue?open=1">Kataloqa keç</Link>
          </Button>
        </div>
      </div>
    );
  }

  const afterProfile = () => {
    if (app) return setStep(1);
    createDraft.mutate(code, {
      onSuccess: (draft) => {
        setAppId(draft.id);
        router.replace(`/cabinet/applications/new?area=${code}&id=${draft.id}`, { scroll: false });
        setStep(1);
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Qaralama yaradılmadı")
    });
  };

  const current = step ?? 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-13 text-ink-3">Yeni müraciət</div>
          <h1 className="text-2xl">{STEPS[current]}</h1>
        </div>
        {app && <span className="text-13 text-ink-3">Qaralama · {app.area.code}</span>}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <Stepper step={current} done={done} onGo={(i) => setStep(i)} />
        <Panel>
          <PanelBody className="p-5">
            {step === null ? (
              <Skeleton className="h-64" />
            ) : current === 0 ? (
              <>
                {createDraft.error && <FormError message={createDraft.error instanceof ApiError ? createDraft.error.message : "Xəta"} />}
                {profile && <EktisCheck profile={profile} className="mb-5" />}
                <ProfileForm profile={profile} submitLabel="Yadda saxla və davam et" onSaved={afterProfile} />
              </>
            ) : !app ? (
              <Skeleton className="h-64" />
            ) : current === 1 ? (
              <ActivityStep app={app} onNext={() => setStep(2)} />
            ) : current === 2 ? (
              <PlanStep app={app} onNext={() => setStep(3)} />
            ) : current === 3 ? (
              <DocumentsStep app={app} onNext={() => setStep(4)} />
            ) : (
              <ReviewStep app={app} onSubmitted={setSubmitted} />
            )}
          </PanelBody>
        </Panel>
        <SummaryAside app={app} areaCode={code} />
      </div>
    </div>
  );
}

export default function NewApplicationPage() {
  return (
    <RequireRole roles={["ENTREPRENEUR"]}>
      <Suspense>
        <Wizard />
      </Suspense>
    </RequireRole>
  );
}
