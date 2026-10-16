"use client";

import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { PasswordInput } from "@/components/ui/password-input";
import { homeFor, useLogin, useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const L = useL();
  const login = useLogin();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Only same-site paths are honoured, so the link cannot redirect elsewhere.
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  // Already signed in: skip the form.
  useEffect(() => {
    if (session) router.replace(safeNext ?? homeFor(session));
  }, [session, safeNext, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email: email.trim(), password }, { onSuccess: (user) => router.replace(safeNext ?? homeFor(user)) });
  };

  const error = login.error instanceof ApiError ? login.error.message : login.error ? "Serverə qoşulmaq alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin." : null;

  return (
    <Stagger step={0.07} delay={0.25}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <StaggerItem>
          <h1 className="text-[34px] leading-tight tracking-[-0.03em]">{L("Portala daxil olun", "Sign in to the portal")}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{L("E-poçt və şifrənizlə daxil olun.", "Sign in with your e-mail and password.")}</p>
        </StaggerItem>
        <FormError message={error} />
        <StaggerItem>
          <Field id="email" label={L("E-poçt", "E-mail")} required>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder={L("ad@nümunə.az", "name@example.com")}
                className="h-12 pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </Field>
        </StaggerItem>
        <StaggerItem>
          <Field id="password" label={L("Şifrə", "Password")} required>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder={L("Şifrəniz", "Your password")}
              className="h-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
        </StaggerItem>
        <StaggerItem>
          <Button type="submit" size="lg" className="group w-full" disabled={login.isPending || !email || !password}>
            {login.isPending ? (
              <>
                <LoaderCircle className="animate-spin" /> {L("Yoxlanılır…", "Checking…")}
              </>
            ) : (
              <>
                {L("Daxil ol", "Sign in")} <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </StaggerItem>
        <StaggerItem>
          <p className="text-center text-sm text-ink-2">
            {L("Hesabınız yoxdur?", "No account yet?")}{" "}
            <Link
              href={safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register"}
              className="font-semibold text-primary hover:underline"
            >
              {L("Qeydiyyatdan keçin", "Register")}
            </Link>
          </p>
        </StaggerItem>
      </form>

    </Stagger>
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
