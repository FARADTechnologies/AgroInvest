"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PARTY, parseRole, RoleChoice } from "@/features/auth/role-choice";
import { useRegister } from "@/features/auth/use-session";
import { ApiError } from "@/lib/api/client";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const register = useRegister();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", consent: false });
  const [role, setRole] = useState(parseRole(params.get("rol")));

  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate({ ...form, role }, {
      onSuccess: () => router.replace(safeNext ?? "/cabinet/profile?welcome=1")
    });
  };

  const apiError = register.error instanceof ApiError ? register.error : null;
  const fieldError = (name: string) => apiError?.forField(name);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl">Qeydiyyat</h1>
        <p className="mt-1 text-sm text-ink-2">
          {PARTY[role].label} hesabı yaradın. Şirkət və ya fərdi məlumatlarınızı növbəti addımda daxil edəcəksiniz.
        </p>
      </div>
      <RoleChoice value={role} onChange={setRole} />
      <FormError message={apiError && apiError.fieldErrors.length === 0 ? apiError.message : null} />
      <Field id="full_name" label="Ad, soyad" required error={fieldError("full_name")}>
        <Input id="full_name" autoComplete="name" value={form.full_name} onChange={set("full_name")} />
      </Field>
      <Field id="email" label="E-poçt" required error={fieldError("email")}>
        <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} />
      </Field>
      <Field
        id="password"
        label="Şifrə"
        required
        hint="Ən azı 8 simvol, hərf və rəqəm"
        error={fieldError("password")}
      >
        <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="consent"
            checked={form.consent}
            onCheckedChange={(v) => setForm((f) => ({ ...f, consent: v === true }))}
            aria-invalid={!!fieldError("consent")}
            className="mt-0.5"
          />
          <label htmlFor="consent" className="text-sm leading-snug text-ink-2">
            Təqdim etdiyim fərdi məlumatların “Fərdi məlumatlar haqqında” Azərbaycan Respublikasının Qanununa
            uyğun olaraq yalnız müsabiqə məqsədilə emal edilməsinə razıyam.{" "}
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              Məxfilik siyasəti
            </Link>
          </label>
        </div>
        {fieldError("consent") && <p className="text-13 text-danger">{fieldError("consent")}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={register.isPending || !form.consent}>
        {register.isPending ? "Yaradılır…" : "Hesab yarat"}
      </Button>
      <p className="text-sm text-ink-2">
        Artıq hesabınız var?{" "}
        <Link href={`/login?rol=${role === "ENTREPRENEUR" ? "sahibkar" : "investor"}`} className="font-medium text-primary hover:underline">
          Daxil olun
        </Link>
      </p>
    </form>
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
