"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { PURPOSES, type Purpose } from "@/lib/domain";

export type AreaSort = "deadline" | "area_desc" | "area_asc" | "code";

export type AreaFilters = {
  purposes: Purpose[];
  region: string;
  rayonId: number | null;
  minHa: number | null;
  maxHa: number | null;
  openOnly: boolean;
  q: string;
  sort: AreaSort;
};

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

/** Filters live in the URL, so a filtered map or catalogue view can be shared as a link. */
export function useAreaFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: AreaFilters = useMemo(
    () => ({
      purposes: (params.get("purpose") ?? "")
        .split(",")
        .filter((p): p is Purpose => (PURPOSES as readonly string[]).includes(p)),
      region: params.get("region") ?? "",
      rayonId: num(params.get("rayon")),
      minHa: num(params.get("min")),
      maxHa: num(params.get("max")),
      openOnly: params.get("open") === "1",
      q: params.get("q") ?? "",
      sort: (params.get("sort") as AreaSort) || "deadline"
    }),
    [params]
  );

  const update = useCallback(
    (patch: Partial<AreaFilters>) => {
      const next = { ...filters, ...patch };
      const sp = new URLSearchParams(params.toString());
      const put = (key: string, value: string | null) => (value ? sp.set(key, value) : sp.delete(key));
      put("purpose", next.purposes.join(","));
      put("region", next.region);
      put("rayon", next.rayonId !== null ? String(next.rayonId) : null);
      put("min", next.minHa !== null ? String(next.minHa) : null);
      put("max", next.maxHa !== null ? String(next.maxHa) : null);
      put("open", next.openOnly ? "1" : null);
      put("q", next.q.trim());
      put("sort", next.sort !== "deadline" ? next.sort : null);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, params, pathname, router]
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  const active =
    filters.purposes.length > 0 ||
    !!filters.region ||
    filters.rayonId !== null ||
    filters.minHa !== null ||
    filters.maxHa !== null ||
    filters.openOnly ||
    !!filters.q;

  return { filters, update, reset, active };
}
