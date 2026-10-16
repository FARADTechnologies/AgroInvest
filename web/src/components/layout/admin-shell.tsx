"use client";

import {
  ArrowLeftRight,
  ArrowUpRight,
  ChartColumn,
  Inbox,
  LandPlot,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Scale,
  ScrollText,
  Store,
  UsersRound,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguageSwitch } from "@/components/layout/app-shell";
import { BrandMark } from "@/components/layout/brand";
import { useAdminCompetitions } from "@/features/admin/api";
import { can, type SessionUser, useLogout, useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Inbox; exact?: boolean; badge?: number };

const ROLE_LABEL: Record<string, [string, string]> = {
  ADMIN: ["Administrator", "Administrator"],
  SPECIALIST: ["Mütəxəssis", "Specialist"],
  SUPERVISOR: ["Rəhbər", "Supervisor"],
  STAFF: ["İşçi", "Staff"]
};

function useSections(user: SessionUser | null | undefined): { title: string; items: Item[] }[] {
  const L = useL();
  const { data: comps } = useAdminCompetitions(undefined, !!user);
  const pending = can(user, "COMPETITIONS_APPROVE") ? comps?.status_counts.PENDING_APPROVAL ?? 0 : 0;
  const when = (ok: boolean, item: Item) => (ok ? [item] : []);
  const sections = [
    { title: L("Ümumi", "General"), items: [{ href: "/admin", label: L("İcmal", "Overview"), icon: LayoutDashboard, exact: true }] },
    {
      title: L("Müraciətlər və sənədlər", "Applications and documents"),
      items: when(can(user, "APPLICATIONS_VIEW"), { href: "/admin/applications", label: L("Müraciətlər", "Applications"), icon: Inbox })
    },
    {
      title: L("Torpaq və müsabiqələr", "Land and competitions"),
      items: [
        { href: "/admin/areas", label: L("Təsərrüfat sahələri", "Farm plots"), icon: LandPlot },
        { href: "/admin/competitions", label: L("Müsabiqələr", "Competitions"), icon: Megaphone, badge: pending || undefined },
        ...when(can(user, "LISTINGS_MANAGE"), { href: "/admin/listings", label: L("Elanlar", "Listings"), icon: Store })
      ]
    },
    {
      title: L("Hesabat və nəzarət", "Reports and oversight"),
      items: [
        ...when(can(user, "STATS_VIEW"), { href: "/admin/stats", label: L("Statistika", "Statistics"), icon: ChartColumn }),
        { href: "/admin/suitability", label: L("Uyğunluq metodologiyası", "Suitability method"), icon: Scale },
        { href: "/admin/integration", label: L("İnteqrasiya logu", "Integration log"), icon: ArrowLeftRight },
        ...when(can(user, "AUDIT_VIEW"), { href: "/admin/audit", label: L("Audit jurnalı", "Audit log"), icon: ScrollText })
      ]
    },
    {
      title: L("İdarəetmə", "Administration"),
      // Only the administrator creates staff accounts and sets what each may do.
      items: when(user?.role === "ADMIN", { href: "/admin/users", label: L("İşçilər və hüquqlar", "Staff and permissions"), icon: UsersRound })
    }
  ];
  return sections.filter((s) => s.items.length > 0);
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const L = useL();
  const { data: user } = useSession();
  const sections = useSections(user);
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3" aria-label={L("İdarəetmə paneli", "Administration console")}>
      {sections.map((s) => (
        <div key={s.title}>
          <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-[0.14em] text-white/40">{s.title}</div>
          <ul className="space-y-0.5">
            {s.items.map(({ href, label, icon: Icon, exact, badge }) => {
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
                      active ? "bg-accent font-semibold text-ink" : "text-white/75 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">{label}</span>
                    {badge ? (
                      <span className={cn("rounded-full px-1.5 text-2xs font-bold leading-5 tabular", active ? "bg-ink text-accent" : "bg-accent text-ink")}>
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Account() {
  const router = useRouter();
  const L = useL();
  const { data: user } = useSession();
  const logout = useLogout();
  if (!user) return null;
  const role = ROLE_LABEL[user.role];
  return (
    <div className="mx-3 flex items-center gap-2.5 rounded-2xl bg-white/5 p-2.5 ring-1 ring-inset ring-white/10">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-13 font-bold text-ink">
        {user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{user.full_name}</div>
        <div className="truncate text-2xs text-white/55">{user.position ?? (role ? L(role[0], role[1]) : user.role)}</div>
      </div>
      <button
        type="button"
        title={L("Çıxış", "Sign out")}
        aria-label={L("Çıxış", "Sign out")}
        onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/") })}
        className="rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const L = useL();
  return (
    <>
      <div className="mb-6 flex items-center gap-3 px-5">
        <BrandMark />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">{L("İdarəetmə paneli", "Administration")}</div>
          <div className="text-2xs uppercase tracking-[0.14em] text-white/45">Agro Invest</div>
        </div>
      </div>
      <Nav onNavigate={onNavigate} />
      <div className="mt-4 space-y-2">
        <Link
          href="/"
          className="mx-3 flex items-center justify-between rounded-2xl px-3 py-2 text-13 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {L("Portala keç", "Open the portal")} <ArrowUpRight className="size-4" aria-hidden />
        </Link>
        <div className="px-3">
          <LanguageSwitch dark />
        </div>
        <Account />
      </div>
    </>
  );
}

/**
 * The administration console: its own frame, apart from the public portal. Applications and
 * their documents, land, competitions and listings are handled only here.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const L = useL();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col bg-side py-5 md:flex">
        <SidebarBody />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label={L("Menyunu bağla", "Close the menu")} className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[280px] flex-col bg-side py-5">
            <button
              type="button"
              aria-label={L("Menyunu bağla", "Close the menu")}
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 rounded-full p-2 text-white/70 hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-bg/80 px-4 backdrop-blur-xl md:hidden">
          <button type="button" aria-label={L("Menyu", "Menu")} onClick={() => setDrawer(true)} className="rounded-full p-2 text-ink-2 hover:bg-surface">
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold">{L("İdarəetmə paneli", "Administration")}</span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
