"use client";

import { Check, CircleAlert, CircleCheck, Clock, FileCheck2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
import { EASE } from "@/components/ui/motion";
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
import { useArea } from "@/features/areas/api";
import { ApiError } from "@/lib/api/client";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { useL, useT } from "@/lib/i18n";
import { cn, formatAzn, formatDate, formatHectares, formatNumber } from "@/lib/utils";

const STEPS = ["Sahibkar", "Sahə və fəaliyyət", "İnvestisiya və biznes plan", "Sənədlər", "Yoxla və göndər"];
const STEPS_EN = ["Applicant", "Plot and activity", "Investment and business plan", "Documents", "Review and submit"];

function Stepper({ step, done, onGo }: { step: number; done: boolean[]; onGo: (i: number) => void }) {
  const L = useL();
  const pct = Math.min(100, (done.filter(Boolean).length / (STEPS.length - 1)) * 100);
  return (
    <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
      <div className="hidden rounded-2xl bg-surface p-3 shadow-card md:block">
        <div className="flex justify-between text-2xs font-semibold text-ink-3">
          <span>{L("Hazırlıq", "Progress")}</span>
          <span className="tabular">{Math.round(pct)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent-strong"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
      </div>
    <ol className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
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
                "relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed",
                active ? "font-semibold text-primary-fg" : "text-ink-2 hover:bg-surface disabled:hover:bg-transparent"
              )}
            >
              {active && (
                <motion.span
                  layoutId="wizard-step"
                  className="absolute inset-0 rounded-2xl bg-primary shadow-[0_8px_18px_-10px_rgb(19_67_47/0.8)]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <span
                className={cn(
                  "relative flex size-7 shrink-0 items-center justify-center rounded-full border text-13 font-semibold tabular",
                  done[i] || active ? "border-transparent bg-accent text-ink" : "border-border-strong bg-surface text-ink-3"
                )}
              >
                {done[i] && !active ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="relative hidden md:inline">{L(label, STEPS_EN[i])}</span>
            </button>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

function SummaryAside({ app, areaCode }: { app: Application | undefined; areaCode: string }) {
  const { data: area } = useArea(areaCode);
  const L = useL();
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
            <div className="rounded-2xl bg-surface-2 px-3 py-2 text-13">
              <div className="font-mono text-ink-2">{area.competition.number}</div>
              <div className="flex items-center justify-between gap-2">
                <span>{L("Son tarix", "Deadline")}: {formatDate(area.competition.deadline_at)}</span>
                <DeadlineBadge iso={area.competition.deadline_at} />
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>
      {app && (
        <Panel>
          <PanelBody className="space-y-2 text-sm">
            <div className="text-13 font-medium text-ink-2">{L("Tamlıq", "Completeness")}</div>
            {(
              [
                [L("Sahibkar məlumatları", "Applicant details"), app.completeness.profile],
                [L("Biznes plan", "Business plan"), app.completeness.business_plan],
                [L("Sənədlər", "Documents"), app.completeness.documents]
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
              <Clock className="size-3.5" aria-hidden /> {L("Qaralama avtomatik yadda saxlanılır", "Drafts save automatically")}
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
  const L = useL();
  const [activity, setActivity] = useState<Purpose>(app.activity);
  const [title, setTitle] = useState(app.project_title ?? "");
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface-2/60 p-4 text-sm">
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
          {L("Müsabiqə", "Competition")}: <span className="font-mono text-ink">{app.competition.number}</span> · {app.competition.title_az}
          {app.min_investment_azn && <div>{L("Minimum investisiya", "Minimum investment")}: {formatAzn(Number(app.min_investment_azn))}</div>}
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-13 font-medium text-ink-2">{L("Planlaşdırılan fəaliyyət", "Planned activity")}</legend>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <PurposeChip key={p} purpose={p} selected={activity === p} onToggle={() => setActivity(p)} />
          ))}
        </div>
        {activity !== app.area.purpose && (
          <p className="mt-2 text-13 text-status-info-fg">
            {L("Seçilmiş fəaliyyət sahənin təyinatından", "The chosen activity differs from the plot's purpose")} ({t.purpose[app.area.purpose]}){L(" fərqlidir; komissiya bunu nəzərə alacaq.", "; the commission will take this into account.")}
          </p>
        )}
      </fieldset>
      <Field id="project_title" label={L("Layihənin adı", "Project title")} hint={L("Məsələn: Damcı suvarma ilə intensiv alma bağı", "For example: intensive apple orchard with drip irrigation")}>
        <Input id="project_title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button
          disabled={update.isPending}
          onClick={() => update.mutate({ activity, project_title: title }, { onSuccess: onNext })}
        >
          {L("Davam et", "Continue")}
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
  const L = useL();
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
          label={L("İnvestisiya məbləği (AZN)", "Investment (AZN)")}
          required
          error={fe("investment_azn")}
          hint={minInv ? `${L("Minimum", "Minimum")}: ${formatAzn(minInv)}` : undefined}
        >
          <Input id="investment_azn" inputMode="decimal" className="tabular" value={form.investment_azn} onChange={set("investment_azn")} />
        </Field>
        <Field id="own_funds_pct" label={L("Öz vəsaitinin payı (%)", "Own funds (%)")} error={fe("own_funds_pct")}>
          <Input id="own_funds_pct" inputMode="decimal" className="tabular" value={form.own_funds_pct} onChange={set("own_funds_pct")} />
        </Field>
        <Field id="jobs_planned" label={L("Yeni iş yerləri", "New jobs")} required error={fe("jobs_planned")}>
          <Input id="jobs_planned" inputMode="numeric" className="tabular" value={form.jobs_planned} onChange={set("jobs_planned")} />
        </Field>
        <Field id="jobs_local" label={L("Onlardan yerli sakinlər üçün", "Of which for local residents")} error={fe("jobs_local")}>
          <Input id="jobs_local" inputMode="numeric" className="tabular" value={form.jobs_local} onChange={set("jobs_local")} />
        </Field>
        <Field id="implementation_months" label={L("İcra müddəti (ay)", "Duration (months)")} required error={fe("implementation_months")}>
          <Input id="implementation_months" inputMode="numeric" className="tabular" value={form.implementation_months} onChange={set("implementation_months")} />
        </Field>
        <Field id="experience_years" label={L("Sahədə təcrübə (il)", "Experience (years)")} error={fe("experience_years")}>
          <Input id="experience_years" inputMode="numeric" className="tabular" value={form.experience_years} onChange={set("experience_years")} />
        </Field>
      </div>
      {minInv && investment > 0 && investment < minInv && (
        <p className="flex items-center gap-1.5 text-13 text-status-info-fg">
          <CircleAlert className="size-3.5" aria-hidden />
          {L("Məbləğ müsabiqə üzrə minimum investisiyadan", "The amount is below the competition minimum")} ({formatAzn(minInv)}){L(" azdır.", ".")}
        </p>
      )}
      <Field id="summary" label={L("Layihənin qısa təsviri", "Project summary")} required error={fe("summary")} hint={`${form.summary.length}/3000`}>
        <Textarea id="summary" maxLength={3000} value={form.summary} onChange={set("summary")} placeholder={L("Nə istehsal ediləcək, hansı həcmdə, hansı texnologiya ilə", "What will be produced, how much, with which technology")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="products_market" label={L("Məhsul və satış bazarı", "Products and market")}>
          <Textarea id="products_market" maxLength={3000} value={form.products_market} onChange={set("products_market")} />
        </Field>
        <Field id="water_plan" label={L("Suvarma və su təchizatı", "Irrigation and water supply")}>
          <Textarea id="water_plan" maxLength={3000} value={form.water_plan} onChange={set("water_plan")} />
        </Field>
      </div>
      <Field id="technology" label={L("Texnologiya və avadanlıq", "Technology and equipment")}>
        <Textarea id="technology" maxLength={3000} value={form.technology} onChange={set("technology")} />
      </Field>
      <div className="flex justify-end">
        <Button disabled={update.isPending} onClick={save}>
          {L("Davam et", "Continue")}
        </Button>
      </div>
    </div>
  );
}

function DocumentsStep({ app, onNext }: { app: Application; onNext: () => void }) {
  const L = useL();
  const upload = useUploadDocument(app.id);
  const remove = useRemoveDocument(app.id);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        {L("PDF, JPG, PNG, DOCX və ya XLSX. Faylın növü məzmununa görə yoxlanılır; sənəd şifrəli serverdə saxlanılır.", "PDF, JPG, PNG, DOCX or XLSX. File type is checked by content; documents are stored encrypted.")}
      </p>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
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
        <Button onClick={onNext}>{L("Davam et", "Continue")}</Button>
      </div>
    </div>
  );
}

function ReviewStep({ app, onSubmitted }: { app: Application; onSubmitted: (a: Application) => void }) {
  const t = useT();
  const submit = useSubmit(app.id);
  const L = useL();
  const [confirmed, setConfirmed] = useState(false);
  const plan = app.business_plan;
  const missing = app.completeness.missing;
  const rows: [string, React.ReactNode][] = [
    [L("Müraciət edən", "Applicant"), app.applicant ? `${app.applicant.display_name} · ${app.applicant.identifier_label} ${app.applicant.identifier}` : "—"],
    [L("Sahə", "Plot"), `${app.area.code} · ${app.area.name_az}`],
    [L("Müsabiqə", "Competition"), app.competition.number],
    [L("Fəaliyyət", "Activity"), t.purpose[app.activity]],
    [L("İnvestisiya", "Investment"), plan.investment_azn ? formatAzn(Number(plan.investment_azn)) : "—"],
    [L("İş yerləri", "Jobs"), plan.jobs_planned != null ? formatNumber(plan.jobs_planned) : "—"],
    [L("İcra müddəti", "Duration"), plan.implementation_months ? `${plan.implementation_months} ${L("ay", "months")}` : "—"],
    [L("Sənədlər", "Documents"), `${app.documents.length} ${L("fayl", "files")}`]
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-2 text-sm">
            <dt className="text-ink-3">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 ? (
        <div role="alert" className="rounded-2xl border border-status-info-fg/30 bg-status-info-bg px-4 py-3 text-sm text-status-info-fg">
          <div className="font-medium">{L("Göndərmək üçün tamamlayın:", "Complete before submitting:")}</div>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
          {L(
            "Təqdim etdiyim məlumatların və sənədlərin doğruluğunu təsdiq edirəm. Yanlış məlumat müraciətin rədd edilməsinə səbəb ola bilər.",
            "I confirm the information and documents are accurate. False information may lead to rejection."
          )}
        </label>
      )}
      <FormError message={submit.error instanceof ApiError ? submit.error.message : null} />
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={missing.length > 0 || !confirmed || submit.isPending}
          onClick={() => submit.mutate(undefined, { onSuccess: onSubmitted })}
        >
          <FileCheck2 /> {submit.isPending ? L("Göndərilir…", "Submitting…") : L("Müraciəti göndər", "Submit application")}
        </Button>
      </div>
    </div>
  );
}

function Submitted({ app }: { app: Application }) {
  const L = useL();
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="relative mx-auto flex size-24 items-center justify-center rounded-full bg-accent"
      >
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-accent-strong"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.8 + i * 0.4, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
          />
        ))}
        <CircleCheck className="size-12 text-primary" aria-hidden />
      </motion.span>
      <h1 className="mt-6 text-3xl">{L("Müraciətiniz qəbul edildi", "Your application was received")}</h1>
      <p className="mt-2 text-ink-2">{L("Müraciət nömrəsi", "Application number")}</p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
        className="mx-auto mt-2 w-fit rounded-2xl bg-primary px-5 py-2 font-mono text-3xl font-medium tracking-tight text-accent"
      >
        {app.number}
      </motion.div>
      <div className="mt-3 flex justify-center">
        <StatusBadge status={app.status} />
      </div>
      <p className="mt-4 text-sm text-ink-2">
        {L("Status dəyişdikcə bildiriş alacaqsınız. Müraciətin bütün tarixçəsi şəxsi kabinetdə görünür.", "You will be notified as the status changes. The full history is in your account.")}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button asChild>
          <Link href={`/cabinet/applications/${app.id}`}>{L("Müraciəti izlə", "Track application")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/map">{L("Xəritəyə qayıt", "Back to the map")}</Link>
        </Button>
      </div>
    </div>
  );
}

function Wizard() {
  const params = useSearchParams();
  const L = useL();
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
        {L("Müraciət etmək üçün əvvəlcə xəritədə və ya kataloqda sahə seçin.", "To apply, first pick a plot on the map or in the catalogue.")}
        <div className="mt-4">
          <Button asChild variant="secondary">
            <Link href="/catalogue?open=1">{L("Kataloqa keç", "Go to the catalogue")}</Link>
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
      onError: (e) => toast.error(e instanceof ApiError ? e.message : L("Qaralama yaradılmadı", "Could not create a draft"))
    });
  };

  const current = step ?? 0;
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-13 font-medium text-ink-3">
            {L("Yeni müraciət · addım", "New application · step")} {current + 1} / {STEPS.length}
          </div>
          <AnimatePresence mode="wait">
            <motion.h1
              key={current}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-[30px] tracking-[-0.03em]"
            >
              {L(STEPS[current], STEPS_EN[current])}
            </motion.h1>
          </AnimatePresence>
        </div>
        {app && <span className="rounded-full bg-surface px-3 py-1 text-13 text-ink-3 shadow-card">{L("Qaralama", "Draft")} · {app.area.code}</span>}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <Stepper step={current} done={done} onGo={(i) => setStep(i)} />
        <Panel className="overflow-hidden">
          <PanelBody className="p-6">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step === null ? "loading" : current}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
            {step === null ? (
              <Skeleton className="h-64" />
            ) : current === 0 ? (
              <>
                {createDraft.error && <FormError message={createDraft.error instanceof ApiError ? createDraft.error.message : L("Xəta", "Error")} />}
                <ProfileForm profile={profile} submitLabel={L("Yadda saxla və davam et", "Save and continue")} onSaved={afterProfile} />
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
              </motion.div>
            </AnimatePresence>
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
