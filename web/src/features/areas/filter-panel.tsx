"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PURPOSES } from "@/lib/domain";
import { useL, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { useRayons, useRegions } from "./api";
import type { AreaFilters, AreaSort } from "./filters";

export const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-xl border border-border bg-surface-2/60 select-chevron pl-3 pr-8 text-sm text-ink transition-colors hover:border-border-strong focus:border-primary/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/10";

export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const L = useL();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  // Debounced so typing does not refetch on every key stroke.
  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={L("Sahə kodu, kənd və ya rayon", "Plot code, village or district")}
        aria-label={L("Axtarış", "Search")}
        className="rounded-full pl-9 pr-9"
      />
      {text && (
        <button
          type="button"
          aria-label={L("Təmizlə", "Clear")}
          onClick={() => setText("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-ink-3 hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function FilterPanel({
  filters,
  update,
  reset,
  active,
  counts,
  showSort = true,
  showSearch = true,
  showPurposes = true,
  className
}: {
  filters: AreaFilters;
  update: (patch: Partial<AreaFilters>) => void;
  reset: () => void;
  active: boolean;
  counts?: Record<string, number>;
  showSort?: boolean;
  showSearch?: boolean;
  showPurposes?: boolean;
  className?: string;
}) {
  const L = useL();
  const { lang } = useLang();
  const { data: regions } = useRegions();
  const { data: rayons } = useRayons();
  const visibleRayons = (rayons ?? []).filter((r) => !filters.region || r.region_code === filters.region);

  const togglePurpose = (p: (typeof PURPOSES)[number]) =>
    update({
      purposes: filters.purposes.includes(p) ? filters.purposes.filter((x) => x !== p) : [...filters.purposes, p]
    });

  return (
    <div className={cn("space-y-4", className)}>
      {showSearch && <SearchBox value={filters.q} onChange={(q) => update({ q })} />}

      {showPurposes && <div>
        <div className="mb-1.5 text-13 font-medium text-ink-2">{L("Təyinat", "Purpose")}</div>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.map((p) => (
            <PurposeChip
              key={p}
              purpose={p}
              count={counts?.[p]}
              selected={filters.purposes.includes(p)}
              onToggle={() => togglePurpose(p)}
            />
          ))}
        </div>
      </div>}

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-13 font-medium text-ink-2">
          Region
          <select
            className={selectClass}
            value={filters.region}
            onChange={(e) => update({ region: e.target.value, rayonId: null })}
          >
            <option value="">{L("Hamısı", "All")}</option>
            {regions?.map((r) => (
              <option key={r.code} value={r.code}>
                {lang === "en" ? r.name_en.replace(" economic region", "") : r.name_az.replace(" iqtisadi rayonu", "")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-13 font-medium text-ink-2">
          {L("Rayon", "District")}
          <select
            className={selectClass}
            value={filters.rayonId ?? ""}
            onChange={(e) => update({ rayonId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{L("Hamısı", "All")}</option>
            {visibleRayons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name_az}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-1 text-13 font-medium text-ink-2">{L("Ölçü (ha)", "Size (ha)")}</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="min"
            aria-label={L("Minimum ölçü, hektar", "Minimum size, hectares")}
            value={filters.minHa ?? ""}
            onChange={(e) => update({ minHa: e.target.value ? Number(e.target.value) : null })}
          />
          <span className="text-ink-3">–</span>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder={L("maks", "max")}
            aria-label={L("Maksimum ölçü, hektar", "Maximum size, hectares")}
            value={filters.maxHa ?? ""}
            onChange={(e) => update({ maxHa: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={filters.openOnly} onCheckedChange={(v) => update({ openOnly: v === true })} />
          {L("Yalnız açıq müsabiqələr", "Open competitions only")}
        </label>
        {active && (
          <button type="button" onClick={reset} className="rounded-full bg-primary-50 px-3 py-1 text-13 font-medium text-primary hover:bg-primary-100">
            {L("Sıfırla", "Reset")}
          </button>
        )}
      </div>

      {showSort && (
        <label className="flex items-center justify-end gap-2 text-13 text-ink-2">
          {L("Sırala", "Sort")}
          <select
            className={cn(selectClass, "h-9 w-auto rounded-full")}
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as AreaSort })}
          >
            <option value="deadline">{L("Son tarixə görə", "By deadline")}</option>
            <option value="area_desc">{L("Ölçü: böyükdən kiçiyə", "Size: largest first")}</option>
            <option value="area_asc">{L("Ölçü: kiçikdən böyüyə", "Size: smallest first")}</option>
            <option value="code">{L("Koda görə", "By code")}</option>
          </select>
        </label>
      )}
    </div>
  );
}
