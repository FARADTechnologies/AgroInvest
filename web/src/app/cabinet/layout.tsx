"use client";

import { Bell, FileText, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { RequireRole } from "@/components/layout/require-role";
import { useNotifications } from "@/features/applications/api";
import { cn } from "@/lib/utils";

function CabinetNav() {
  const pathname = usePathname();
  const { data: notes } = useNotifications();
  const items = [
    { href: "/cabinet", label: "Müraciətlərim", icon: FileText, exact: true },
    { href: "/cabinet/notifications", label: "Bildirişlər", icon: Bell, badge: notes?.unread },
    { href: "/cabinet/profile", label: "Sahibkar məlumatları", icon: UserRound }
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Kabinet">
      {items.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href || pathname.startsWith("/cabinet/applications/") : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm",
              active ? "bg-primary-50 font-medium text-primary" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {!!badge && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-2xs font-semibold text-white tabular">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The wizard uses the full width.
  if (pathname.startsWith("/cabinet/applications/new")) return <>{children}</>;
  return (
    <RequireRole roles={["ENTREPRENEUR"]}>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)] lg:px-6 print:block print:p-0">
        <aside className="print:hidden">
          <div className="mb-3 px-3 text-13 font-medium uppercase tracking-wide text-ink-3">Şəxsi kabinet</div>
          <CabinetNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </RequireRole>
  );
}
