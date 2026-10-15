"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PARTY, parseRole, RoleChoice } from "@/features/auth/role-choice";
import { homeFor, useLogin } from "@/features/auth/use-session";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(parseRole(params.get("rol")));

  // Only same-site paths are honoured, so the link cannot redirect elsewhere.
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: (user) => router.replace(safeNext ?? homeFor(user)) }
    );
  };

  const error = login.error instanceof ApiError ? login.error.message : login.error ? "Xəta baş verdi" : null;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl">Daxil ol</h1>
        <p className="mt-1 text-sm text-ink-2">Hesab növünü seçin və hesabınıza daxil olun.</p>
      </div>
      <RoleChoice value={role} onChange={setRole} />
      <FormError message={error} />
      <Field id="email" label="E-poçt" required>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field id="password" label="Şifrə" required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={login.isPending || !email || !password}>
        {login.isPending ? "Yoxlanılır…" : `${PARTY[role].label} kimi daxil ol`}
      </Button>
      <p className="text-sm text-ink-2">
        Hesabınız yoxdur?{" "}
        <Link
          href={`/register?rol=${role === "ENTREPRENEUR" ? "sahibkar" : "investor"}${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`}
          className="font-medium text-primary hover:underline"
        >
          Qeydiyyatdan keçin
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
