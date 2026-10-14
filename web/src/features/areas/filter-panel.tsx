"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PURPOSES } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { useRayons, useRegions } from "./api";
import type { AreaFilters, AreaSort } from "./filters";

export const selectClass =
  "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-ink";

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Sahə kodu, kənd və ya rayon"
        aria-label="Axtarış"
        className="pl-8 pr-8"
      />
      {text && (
        <button
          type="button"
          aria-label="Təmizlə"
          onClick={() => setText("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink"
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
  className
}: {
  filters: AreaFilters;
  update: (patch: Partial<AreaFilters>) => void;
  reset: () => void;
  active: boolean;
  counts?: Record<string, number>;
  showSort?: boolean;
  className?: string;
}) {
  const { data: regions } = useRegions();
  const { data: rayons } = useRayons();
  const visibleRayons = (rayons ?? []).filter((r) => !filters.region || r.region_code === filters.region);

  const togglePurpose = (p: (typeof PURPOSES)[number]) =>
    update({
      purposes: filters.purposes.includes(p) ? filters.purposes.filter((x) => x !== p) : [...filters.purposes, p]
    });

  return (
    <div className={cn("space-y-4", className)}>
      <SearchBox value={filters.q} onChange={(q) => update({ q })} />

      <div>
        <div className="mb-1.5 text-13 font-medium text-ink-2">Təyinat</div>
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
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-13 font-medium text-ink-2">
          Region
          <select
            className={selectClass}
            value={filters.region}
            onChange={(e) => update({ region: e.target.value, rayonId: null })}
          >
            <option value="">Hamısı</option>
            {regions?.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name_az.replace(" iqtisadi rayonu", "")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-13 font-medium text-ink-2">
          Rayon
          <select
            className={selectClass}
            value={filters.rayonId ?? ""}
            onChange={(e) => update({ rayonId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Hamısı</option>
            {visibleRayons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name_az}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div className="mb-1 text-13 font-medium text-ink-2">Ölçü (ha)</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="min"
            aria-label="Minimum ölçü, hektar"
            value={filters.minHa ?? ""}
            onChange={(e) => update({ minHa: e.target.value ? Number(e.target.value) : null })}
          />
          <span className="text-ink-3">–</span>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="maks"
            aria-label="Maksimum ölçü, hektar"
            value={filters.maxHa ?? ""}
            onChange={(e) => update({ maxHa: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <Checkbox checked={filters.openOnly} onCheckedChange={(v) => update({ openOnly: v === true })} />
          Yalnız açıq müsabiqələr
        </label>
        {active && (
          <button type="button" onClick={reset} className="text-13 font-medium text-primary hover:underline">
            Sıfırla
          </button>
        )}
      </div>

      {showSort && (
        <label className="flex items-center justify-end gap-2 text-13 text-ink-2">
          Sırala
          <select
            className={cn(selectClass, "h-8 w-auto")}
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as AreaSort })}
          >
            <option value="deadline">Son tarixə görə</option>
            <option value="area_desc">Ölçü: böyükdən kiçiyə</option>
            <option value="area_asc">Ölçü: kiçikdən böyüyə</option>
            <option value="code">Koda görə</option>
          </select>
        </label>
      )}
    </div>
  );
}
