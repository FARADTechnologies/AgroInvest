"use client";

import { ArrowLeftRight, ChartColumn, Inbox, LandPlot, Megaphone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { RequireRole } from "@/components/layout/require-role";
import { useAdminCompetitions } from "@/features/admin/api";
import { useSession } from "@/features/auth/use-session";
import { cn } from "@/lib/utils";

function AdminNav() {
  const pathname = usePathname();
  const { data: user } = useSession();
  const { data: comps } = useAdminCompetitions();
  const pending = comps?.status_counts.PENDING_APPROVAL ?? 0;
  const items = [
    { href: "/admin/applications", label: "Müraciətlər", icon: Inbox, badge: 0 },
    {
      href: "/admin/competitions",
      label: "Müsabiqələr",
      icon: Megaphone,
      // Supervisors see how many competitions wait for their approval.
      badge: user && user.role !== "SPECIALIST" ? pending : 0
    },
    { href: "/admin/areas", label: "Təsərrüfat sahələri", icon: LandPlot, badge: 0 },
    { href: "/admin/stats", label: "Statistika və hesabatlar", icon: ChartColumn, badge: 0 },
    { href: "/admin/integration", label: "İnteqrasiya logu", icon: ArrowLeftRight, badge: 0 }
  ];
  return (
    <nav className="space-y-0.5" aria-label="İdarəetmə">
      {items.map(({ href, label, icon: Icon, badge }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
            pathname.startsWith(href) ? "bg-primary-50 font-medium text-primary" : "text-ink-2 hover:bg-surface-2"
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span
              className="rounded-full bg-accent px-1.5 text-2xs font-semibold leading-5 text-white tabular"
              title="Təsdiq gözləyən müsabiqələr"
            >
              {badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["SPECIALIST", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface px-3 py-5 md:block">
          <div className="mb-3 px-3 text-13 font-medium uppercase tracking-wide text-ink-3">İdarəetmə paneli</div>
          <AdminNav />
        </aside>
        <div className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</div>
      </div>
    </RequireRole>
  );
}
