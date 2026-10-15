"use client";

import { ArrowRight, Briefcase, Building2, LandPlot, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { PasswordInput } from "@/components/ui/password-input";
import { PARTY, type PartyRole, parseRole, RoleChoice } from "@/features/auth/role-choice";
import { homeFor, useLogin, useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";
import { ApiError } from "@/lib/api/client";

// Seeded demo accounts (README). Only the address is filled in; the password is typed.
const DEMO: { email: string; label: string; en: string; icon: typeof Briefcase; role?: PartyRole }[] = [
  { email: "investor@agro-demo.test", label: "İnvestor", en: "Investor", icon: Briefcase, role: "INVESTOR" },
  { email: "sahibkar@agro-demo.test", label: "Sahibkar", en: "Land owner", icon: LandPlot, role: "ENTREPRENEUR" },
  { email: "mutexessis@agro-demo.test", label: "Mütəxəssis", en: "Specialist", icon: Building2 },
  { email: "rehber@agro-demo.test", label: "Rəhbər", en: "Supervisor", icon: ShieldCheck }
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const L = useL();
  const login = useLogin();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PartyRole>(parseRole(params.get("rol")));
  const passwordRef = useRef<HTMLInputElement>(null);

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

  const error = login.error instanceof ApiError ? login.error.message : login.error ? L("Xəta baş verdi", "Something went wrong") : null;

  return (
    <Stagger step={0.07} delay={0.25}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <StaggerItem>
          <h1 className="text-[34px] leading-tight tracking-[-0.03em]">{L("Portala daxil olun", "Sign in to the portal")}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{L("Hesab növünü seçin və e-poçt və şifrənizlə daxil olun. Komissiya əməkdaşları sadəcə e-poçtla daxil olur.", "Choose the account type and sign in. Commission staff just sign in with their e-mail.")}</p>
        </StaggerItem>
        <StaggerItem>
          <RoleChoice value={role} onChange={setRole} />
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
              ref={passwordRef}
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
                {L(`${PARTY[role].label} kimi daxil ol`, "Sign in")} <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </StaggerItem>
        <StaggerItem>
          <p className="text-center text-sm text-ink-2">
            {L("Hesabınız yoxdur?", "No account yet?")}{" "}
            <Link
              href={`/register?rol=${role === "ENTREPRENEUR" ? "sahibkar" : "investor"}${safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""}`}
              className="font-semibold text-primary hover:underline"
            >
              {L("Qeydiyyatdan keçin", "Register")}
            </Link>
          </p>
        </StaggerItem>
      </form>

      <StaggerItem className="mt-8 rounded-3xl border border-dashed border-border-strong bg-surface-2/60 p-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">{L("Demo hesablar", "Demo accounts")}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {DEMO.map(({ email: demo, label, en, icon: Icon, role: demoRole }) => (
            <motion.button
              key={demo}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setEmail(demo);
                if (demoRole) setRole(demoRole);
                passwordRef.current?.focus();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-13 font-medium text-ink-2 shadow-card transition hover:border-primary/40 hover:text-primary"
            >
              <Icon className="size-3.5" aria-hidden /> {L(label, en)}
            </motion.button>
          ))}
        </div>
        <p className="mt-2 text-2xs text-ink-3">{L("Şifrə", "Password")}: <span className="font-mono">.env</span> → DEMO_PASSWORD.</p>
      </StaggerItem>
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
