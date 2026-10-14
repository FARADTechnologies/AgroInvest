"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { RequireRole } from "@/components/layout/require-role";
import { cn } from "@/lib/utils";

const NAV = [{ href: "/admin/applications", label: "Müraciətlər", icon: Inbox }];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireRole roles={["SPECIALIST", "SUPERVISOR", "ADMIN"]}>
      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface px-3 py-5 md:block">
          <div className="mb-3 px-3 text-13 font-medium uppercase tracking-wide text-ink-3">İdarəetmə paneli</div>
          <nav className="space-y-0.5" aria-label="İdarəetmə">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
                  pathname.startsWith(href) ? "bg-primary-50 font-medium text-primary" : "text-ink-2 hover:bg-surface-2"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</div>
      </div>
    </RequireRole>
  );
}
