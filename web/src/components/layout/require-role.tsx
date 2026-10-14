"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/panel";
import { type Role, useSession } from "@/features/auth/use-session";

/**
 * Client-side gate for pages. The API enforces the same rules on every request;
 * this only decides what to render and where to send visitors.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
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
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldX className="mx-auto size-10 text-danger" aria-hidden />
        <h1 className="mt-4 text-xl">Giriş qadağandır</h1>
        <p className="mt-2 text-sm text-ink-2">Bu səhifə sizin rolunuz üçün əlçatan deyil. Cəhd qeydə alındı.</p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/map">Əsas səhifəyə qayıt</Link>
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
