"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { type Role, useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";

/**
 * Client-side gate for pages. The API enforces the same rules on every request;
 * this only decides what to render and where to send visitors.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const L = useL();
  const { data: user, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && user === null) {
      const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading || user === null || user === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-8 lg:px-8">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-danger-50">
          <ShieldX className="size-8 text-danger" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl">{L("Giriş qadağandır", "Access denied")}</h1>
        <p className="mt-2 text-sm text-ink-2">{L("Bu səhifə sizin rolunuz üçün əlçatan deyil. Cəhd qeydə alındı.", "This page is not available for your role. The attempt was logged.")}</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">{L("Xəritəyə qayıt", "Back to the map")}</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
