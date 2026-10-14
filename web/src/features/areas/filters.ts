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
  /** Maliyyə şərtləri: annual lease fee (AZN/ha) and the lot's minimum investment (AZN). */
  feeMin: number | null;
  feeMax: number | null;
  invMin: number | null;
  invMax: number | null;
};

const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

export const financeActive = (f: AreaFilters) =>
  f.feeMin !== null || f.feeMax !== null || f.invMin !== null || f.invMax !== null;

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
      sort: (params.get("sort") as AreaSort) || "deadline",
      feeMin: num(params.get("fee_min")),
      feeMax: num(params.get("fee_max")),
      invMin: num(params.get("inv_min")),
      invMax: num(params.get("inv_max"))
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
      put("fee_min", next.feeMin !== null ? String(next.feeMin) : null);
      put("fee_max", next.feeMax !== null ? String(next.feeMax) : null);
      put("inv_min", next.invMin !== null ? String(next.invMin) : null);
      put("inv_max", next.invMax !== null ? String(next.invMax) : null);
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
    !!filters.q ||
    financeActive(filters);

  return { filters, update, reset, active };
}
