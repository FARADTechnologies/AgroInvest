"use client";

import {
  Bell,
  ChartColumn,
  GitCompareArrows,
  Inbox,
  LandPlot,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  UserRound,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Brand, BrandMark } from "@/components/layout/brand";
import { NotificationBell } from "@/components/layout/notification-bell";
import { EASE } from "@/components/ui/motion";
import { useAdminCompetitions } from "@/features/admin/api";
import { useNotifications } from "@/features/applications/api";
import { useCompare } from "@/features/areas/compare-store";
import { isStaff, type SessionUser, useLogout, useSession } from "@/features/auth/use-session";
import { type Lang, useL, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const ROLE_LABEL: Record<string, { az: string; en: string }> = {
  ENTREPRENEUR: { az: "Sahibkar", en: "Entrepreneur" },
  SPECIALIST: { az: "Mütəxəssis", en: "Specialist" },
  SUPERVISOR: { az: "Rəhbər", en: "Supervisor" },
  ADMIN: { az: "Administrator", en: "Administrator" }
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof MapIcon;
  badge?: number;
  /** Also active on these path prefixes. */
  also?: string[];
  exact?: boolean;
};

// Whether the desktop sidebar is expanded. Starts folded to an icon rail and
// remembers the visitor's choice.
const SidebarContext = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });
const SIDEBAR_KEY = "sidebar-open";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function useNav(user: SessionUser | null | undefined) {
  const L = useL();
  const staff = isStaff(user);
  const entrepreneur = !!user && !staff;
  const { codes } = useCompare();
  const { data: notes } = useNotifications(entrepreneur);
  const { data: comps } = useAdminCompetitions(undefined, staff);
  const pending = user && user.role !== "SPECIALIST" ? comps?.status_counts.PENDING_APPROVAL ?? 0 : 0;

  const sections: { title: string; items: NavItem[] }[] = [];
  if (entrepreneur) {
    sections.push({
      title: L("Kabinet", "Account"),
      items: [
        { href: "/cabinet", label: L("Ümumi baxış", "Overview"), icon: LayoutDashboard, exact: true, also: ["/cabinet/applications"] },
        { href: "/cabinet/notifications", label: L("Bildirişlər", "Notifications"), icon: Bell, badge: notes?.unread },
        { href: "/cabinet/profile", label: L("Sahibkar məlumatları", "Applicant details"), icon: UserRound }
      ]
    });
  }
  if (staff) {
    sections.push({
      title: L("İdarəetmə", "Administration"),
      items: [
        { href: "/admin/applications", label: L("Müraciətlər", "Applications"), icon: Inbox },
        { href: "/admin/competitions", label: L("Müsabiqələr", "Competitions"), icon: Megaphone, badge: pending },
        { href: "/admin/areas", label: L("Təsərrüfat sahələri", "Farm areas"), icon: LandPlot },
        { href: "/admin/stats", label: L("Statistika", "Statistics"), icon: ChartColumn }
      ]
    });
  }
  sections.push({
    title: L("Kəşf et", "Explore"),
    items: [
      { href: "/map", label: L("Xəritə", "Map"), icon: MapIcon, also: ["/areas"] },
      { href: "/catalogue", label: L("Kataloq", "Catalogue"), icon: LayoutGrid },
      { href: "/competitions", label: L("Müsabiqələr", "Competitions"), icon: Megaphone },
      { href: "/compare", label: L("Müqayisə", "Compare"), icon: GitCompareArrows, badge: codes.length || undefined }
    ]
  });
  return sections;
}

function isActive(pathname: string, item: NavItem) {
  const match = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (item.exact) return pathname === item.href || (item.also ?? []).some(match);
  return match(item.href) || (item.also ?? []).some(match);
}

/** Navigation list; `rail` renders icons only (labels become tooltips). */
function NavLinks({ rail = false, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useSession();
  const sections = useNav(user);
  const id = rail ? "rail" : "full";
  return (
    <nav aria-label="Əsas menyu" className={rail ? "space-y-4" : "space-y-6"}>
      {sections.map((section) => (
        <div key={section.title}>
          {rail ? (
            <div className="mx-auto mb-2 h-px w-6 bg-white/15" aria-hidden />
          ) : (
            <div className="mb-2 px-3 text-2xs font-semibold uppercase tracking-[0.16em] text-white/35">{section.title}</div>
          )}
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.label}
                    aria-label={rail ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
                      rail ? "justify-center px-0" : "px-3",
                      active ? "text-white" : "text-white/60 hover:text-white"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`nav-active-${id}`}
                        className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-inset ring-white/10"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                    {active && (
                      <motion.span
                        layoutId={`nav-bar-${id}`}
                        className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                    <Icon
                      className={cn("relative size-[18px] shrink-0 transition-transform duration-300 ease-spring group-hover:scale-110", active && "text-accent")}
                      aria-hidden
                    />
                    {!rail && <span className="relative flex-1 truncate">{item.label}</span>}
                    {!!item.badge && (
                      <span
                        className={cn(
                          "rounded-full bg-accent text-2xs font-bold text-ink tabular",
                          rail ? "absolute right-1.5 top-1 px-1 leading-4" : "relative px-1.5 leading-5"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
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

function AccountCard({ rail = false }: { rail?: boolean }) {
  const router = useRouter();
  const L = useL();
  const { lang } = useLang();
  const { data: user, isLoading } = useSession();
  const logout = useLogout();
  if (isLoading) return <div className="h-14 animate-pulse rounded-2xl bg-white/5" />;
  if (!user) {
    return (
      <div className={cn(!rail && "rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10")}>
        {!rail && (
          <p className="mb-2.5 text-13 leading-snug text-white/60">
            {L("Müraciət etmək və statusu izləmək üçün daxil olun.", "Sign in to apply and track your applications.")}
          </p>
        )}
        <Link
          href="/login"
          title={L("Daxil ol", "Sign in")}
          className="flex h-10 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-ink transition-colors hover:bg-accent-strong"
        >
          <LogIn className="size-4" aria-hidden />
          {!rail && L("Daxil ol", "Sign in")}
        </Link>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-2.5", rail ? "flex-col" : "rounded-2xl bg-white/5 p-2 ring-1 ring-inset ring-white/10")}>
      <Link
        href={isStaff(user) ? "/admin/applications" : "/cabinet/profile"}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-ink"
        title={user.full_name}
      >
        {initials(user.full_name)}
      </Link>
      {!rail && (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-13 font-semibold text-white">{user.full_name}</div>
          <div className="truncate text-2xs text-white/50">{ROLE_LABEL[user.role]?.[lang]}</div>
        </div>
      )}
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

function Sidebar() {
  const { open, toggle } = useContext(SidebarContext);
  const L = useL();
  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 260 : 76 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-side py-5 md:flex"
    >
      <div className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <div className={cn("relative mb-6 flex items-center", open ? "justify-between px-4" : "flex-col gap-3 px-3")}>
        {open ? <Brand light /> : <Link href="/" aria-label="Aqrar İnvestisiya Portalı"><BrandMark /></Link>}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title={open ? L("Menyunu bağla", "Collapse menu") : L("Menyunu aç", "Expand menu")}
          aria-label={open ? L("Menyunu bağla", "Collapse menu") : L("Menyunu aç", "Expand menu")}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {open ? <PanelLeftClose className="size-[18px]" /> : <PanelLeftOpen className="size-[18px]" />}
        </button>
      </div>
      <div className={cn("scrollbar-thin relative flex-1 overflow-y-auto overflow-x-hidden", open ? "px-4" : "px-3")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={open ? "full" : "rail"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <NavLinks rail={!open} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={cn("relative mt-4", open ? "px-4" : "px-3")}>
        <AccountCard rail={!open} />
      </div>
    </motion.aside>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-side px-4 py-5 md:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div className="mb-8 flex items-center justify-between">
              <Brand light />
              <button type="button" onClick={onClose} aria-label={L("Bağla", "Close")} className="rounded-full p-2 text-white/70 hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={onClose} />
            </div>
            <AccountCard />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/** Area search from anywhere: jumps to the map with the query applied. */
function QuickSearch() {
  const router = useRouter();
  const L = useL();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/map?q=${encodeURIComponent(q.trim())}` : "/map");
      }}
      className="relative hidden w-full max-w-md sm:block"
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={L("Sahə kodu, kənd və ya rayon axtar…", "Search by plot code, village or district…")}
        aria-label={L("Sahə axtarışı", "Plot search")}
        className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-14 text-sm shadow-card outline-none transition placeholder:text-ink-3 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-2xs text-ink-3">
        Ctrl K
      </kbd>
    </form>
  );
}

/** AZ / EN switch with a sliding pill. */
export function LanguageSwitch({ className, dark = false }: { className?: string; dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label="Dil / Language"
      className={cn(
        "relative flex items-center rounded-full p-0.5 text-2xs font-bold",
        dark ? "border border-white/20 bg-white/10" : "border border-border bg-surface shadow-card",
        className
      )}
    >
      {(["az", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            "relative rounded-full px-2.5 py-1 uppercase transition-colors",
            lang === l ? "text-primary-fg" : dark ? "text-white/70 hover:text-white" : "text-ink-3 hover:text-ink"
          )}
        >
          {lang === l && (
            <motion.span
              layoutId={`lang-pill-${dark ? "dark" : "light"}`}
              className="absolute inset-0 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { data: user } = useSession();
  const { open, toggle } = useContext(SidebarContext);
  const L = useL();
  const entrepreneur = !!user && !isStaff(user);
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-bg/80 px-4 backdrop-blur-xl lg:px-6">
      <button type="button" className="rounded-full p-2 text-ink-2 hover:bg-surface md:hidden" aria-label={L("Menyu", "Menu")} onClick={onMenu}>
        <Menu className="size-5" />
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? L("Menyunu bağla", "Collapse menu") : L("Menyunu aç", "Expand menu")}
        title={open ? L("Menyunu bağla", "Collapse menu") : L("Menyunu aç", "Expand menu")}
        className="hidden size-10 items-center justify-center rounded-full border border-border bg-surface text-ink-2 shadow-card transition hover:text-ink md:flex"
      >
        <Menu className="size-[18px]" />
      </button>
      <Brand compact className="md:hidden" />
      <QuickSearch />
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitch />
        {entrepreneur && <NotificationBell />}
        {entrepreneur && (
          <Link
            href="/catalogue?open=1"
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg shadow-[0_6px_16px_-8px_rgb(19_67_47/0.7)] transition hover:bg-primary-hover sm:flex"
          >
            <Plus className="size-4" aria-hidden /> {L("Yeni müraciət", "New application")}
          </Link>
        )}
        {!user && (
          <Link
            href="/login"
            className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg transition hover:bg-primary-hover md:hidden"
          >
            {L("Daxil ol", "Sign in")}
          </Link>
        )}
      </div>
    </header>
  );
}

/** Sidebar + top bar around every in-app page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      // Storage blocked: start folded.
    }
  }, []);
  const toggle = useCallback(() => {
    setOpen((v) => {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1");
      } catch {
        // The choice still applies to this page view.
      }
      return !v;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      <div className="flex min-h-screen">
        <Sidebar />
        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawer(true)} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

/** Marketing and sign-in pages are full-bleed; everything else lives in the app shell. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/" || pathname === "/login" || pathname === "/register";
  if (bare) return <main>{children}</main>;
  return <AppShell>{children}</AppShell>;
}
