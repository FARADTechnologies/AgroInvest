"use client";

import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EASE, Stagger, StaggerItem } from "@/components/ui/motion";
import { PasswordInput } from "@/components/ui/password-input";
import { useRegister } from "@/features/auth/use-session";
import { ApiError } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Mirrors the API rule, so the applicant sees it before submitting.
const RULES = [
  { label: "8+ simvol", en: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "hərf", en: "a letter", test: (p: string) => /\p{L}/u.test(p) },
  { label: "rəqəm", en: "a digit", test: (p: string) => /\d/.test(p) }
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const L = useL();
  const register = useRegister();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", consent: false });

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(
      { ...form, email: form.email.trim(), full_name: form.full_name.trim() },
      { onSuccess: () => router.replace(safeNext ?? "/cabinet/profile?welcome=1") }
    );
  };

  const apiError = register.error instanceof ApiError ? register.error : null;
  const fieldError = (name: string) => apiError?.forField(name);
  const passed = RULES.filter((r) => r.test(form.password)).length;

  return (
    <Stagger step={0.06} delay={0.25}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <StaggerItem>
          <h1 className="text-[34px] leading-tight tracking-[-0.03em]">{L("Sahibkar hesabı", "Entrepreneur account")}</h1>
          <p className="mt-1.5 text-sm text-ink-2">
            {L("Bir dəqiqəyə qeydiyyatdan keçin. Şirkət və ya fərdi məlumatlarınızı növbəti addımda daxil edəcəksiniz.", "Register in a minute. You will add company or personal details in the next step.")}
          </p>
        </StaggerItem>
        <FormError message={apiError && apiError.fieldErrors.length === 0 ? apiError.message : null} />
        <StaggerItem>
          <Field id="full_name" label={L("Ad, soyad", "Full name")} required error={fieldError("full_name")}>
            <Input id="full_name" autoComplete="name" className="h-12" value={form.full_name} onChange={set("full_name")} />
          </Field>
        </StaggerItem>
        <StaggerItem>
          <Field id="email" label={L("E-poçt", "E-mail")} required error={fieldError("email")}>
            <Input id="email" type="email" autoComplete="email" className="h-12" value={form.email} onChange={set("email")} />
          </Field>
        </StaggerItem>
        <StaggerItem>
          <Field id="password" label={L("Şifrə", "Password")} required error={fieldError("password")}>
            <PasswordInput id="password" autoComplete="new-password" className="h-12" value={form.password} onChange={set("password")} />
          </Field>
          {/* Strength: three segments that fill as the rules are met. */}
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {RULES.map((_, i) => (
              <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <motion.span
                  className={cn("block h-full rounded-full", passed === 3 ? "bg-status-won-fg" : passed === 2 ? "bg-accent-strong" : "bg-status-info-fg")}
                  initial={false}
                  animate={{ width: i < passed ? "100%" : "0%" }}
                  transition={{ duration: 0.35, ease: EASE }}
                />
              </span>
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-2xs">
            {RULES.map((r) => {
              const ok = r.test(form.password);
              return (
                <li
                  key={r.label}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition-colors",
                    ok ? "bg-status-won-bg text-status-won-fg" : "bg-surface-2 text-ink-3"
                  )}
                >
                  <Check className={cn("size-3 transition-opacity", ok ? "opacity-100" : "opacity-30")} aria-hidden />
                  {L(r.label, r.en)}
                </li>
              );
            })}
          </ul>
        </StaggerItem>
        <StaggerItem className="space-y-1.5">
          <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2/70 p-3">
            <Checkbox
              id="consent"
              checked={form.consent}
              onCheckedChange={(v) => setForm((f) => ({ ...f, consent: v === true }))}
              aria-invalid={!!fieldError("consent")}
              className="mt-0.5"
            />
            <label htmlFor="consent" className="text-13 leading-snug text-ink-2">
              {L(
                "Təqdim etdiyim fərdi məlumatların “Fərdi məlumatlar haqqında” Azərbaycan Respublikasının Qanununa uyğun olaraq yalnız müsabiqə məqsədilə emal edilməsinə razıyam.",
                "I consent to my personal data being processed solely for the competition, under the Law of the Republic of Azerbaijan “On Personal Data”."
              )}{" "}
              <Link href="/privacy" className="font-semibold text-primary hover:underline">
                {L("Məxfilik siyasəti", "Privacy policy")}
              </Link>
            </label>
          </div>
          {fieldError("consent") && <p className="text-13 text-danger">{fieldError("consent")}</p>}
        </StaggerItem>
        <StaggerItem>
          <Button type="submit" size="lg" className="group w-full" disabled={register.isPending || !form.consent}>
            {register.isPending ? (
              <>
                <LoaderCircle className="animate-spin" /> {L("Yaradılır…", "Creating…")}
              </>
            ) : (
              <>
                {L("Hesab yarat", "Create account")} <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </StaggerItem>
        <StaggerItem>
          <p className="text-center text-sm text-ink-2">
            {L("Artıq hesabınız var?", "Already registered?")}{" "}
            <Link href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"} className="font-semibold text-primary hover:underline">
              {L("Daxil olun", "Sign in")}
            </Link>
          </p>
        </StaggerItem>
      </form>
    </Stagger>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
