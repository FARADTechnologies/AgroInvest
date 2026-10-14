"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { NotificationBell } from "@/components/layout/notification-bell";
import { isStaff, useLogout, useSession } from "@/features/auth/use-session";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  ENTREPRENEUR: "Sahibkar",
  SPECIALIST: "Mütəxəssis",
  SUPERVISOR: "Rəhbər",
  ADMIN: "Administrator"
};

function AccountArea() {
  const t = useT();
  const router = useRouter();
  const { data: user, isLoading } = useSession();
  const logout = useLogout();

  if (isLoading) return <div className="h-8 w-24 animate-pulse rounded-md bg-surface-2" />;
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:bg-primary-hover"
      >
        {t.nav.signIn}
      </Link>
    );
  }
  const staff = isStaff(user);
  return (
    <div className="flex items-center gap-1">
      {!staff && <NotificationBell />}
      <Link
        href={staff ? "/admin/applications" : "/cabinet"}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-2"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-50 text-primary">
          <UserRound className="size-4" aria-hidden />
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-13 font-medium text-ink">{user.full_name}</span>
          <span className="block text-2xs text-ink-3">{ROLE_LABEL[user.role]}</span>
        </span>
      </Link>
      <button
        type="button"
        title={t.nav.signOut}
        aria-label={t.nav.signOut}
        onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/map") })}
        className="rounded-md p-2 text-ink-3 hover:bg-surface-2 hover:text-ink"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function Wordmark() {
  const t = useT();
  return (
    <Link href="/map" className="flex items-center gap-2.5">
      {/* Field furrows: a neutral mark, deliberately not a state emblem. */}
      <svg viewBox="0 0 24 24" className="size-7 shrink-0" aria-hidden>
        <rect width="24" height="24" rx="5" fill="rgb(var(--primary))" />
        <path d="M5 16.5c3-2 5-2 7 0s4 2 7 0" stroke="rgb(var(--accent))" strokeWidth="1.8" fill="none" />
        <path d="M5 11.5c3-2 5-2 7 0s4 2 7 0" stroke="#fff" strokeWidth="1.8" fill="none" opacity=".9" />
        <path d="M5 6.5c3-2 5-2 7 0s4 2 7 0" stroke="#fff" strokeWidth="1.8" fill="none" opacity=".55" />
      </svg>
      <span className="text-15 font-semibold leading-tight text-ink">{t.app.name}</span>
      <span className="rounded-sm border border-accent/50 bg-accent-50 px-1.5 py-px text-2xs font-medium uppercase tracking-wide text-accent-text">
        {t.app.prototype}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const { data: user } = useSession();
  const links = [
    { href: "/map", label: t.nav.map },
    { href: "/catalogue", label: t.nav.catalogue },
    { href: "/competitions", label: t.nav.competitions },
    ...(user && !isStaff(user) ? [{ href: "/cabinet", label: t.nav.cabinet }] : []),
    ...(isStaff(user) ? [{ href: "/admin/applications", label: t.nav.admin }] : []),
    { href: "/about", label: t.nav.about }
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-6 px-4 lg:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Əsas menyu">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary-50 text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center rounded-md border border-border text-13" aria-label={t.nav.language}>
            <span className="rounded-l-md bg-surface-2 px-2 py-1 font-medium text-ink">AZ</span>
            <span className="px-2 py-1 text-ink-3" title="Tezliklə">EN</span>
          </div>
          <AccountArea />
        </div>
      </div>
    </header>
  );
}
