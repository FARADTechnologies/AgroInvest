"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PURPOSES } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { useRayons, useRegions } from "./api";
import { type AreaFilters, type AreaSort, financeActive } from "./filters";

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

/** A min–max pair; typing is debounced so each key stroke does not refetch. */
function RangeInputs({
  min,
  max,
  onChange,
  label,
  step
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  label: string;
  step?: number;
}) {
  const [text, setText] = useState({ min: min?.toString() ?? "", max: max?.toString() ?? "" });
  useEffect(() => setText({ min: min?.toString() ?? "", max: max?.toString() ?? "" }), [min, max]);
  useEffect(() => {
    const parse = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const next = [parse(text.min), parse(text.max)] as const;
    if (next[0] === min && next[1] === max) return;
    const timer = setTimeout(() => onChange(next[0], next[1]), 400);
    return () => clearTimeout(timer);
  }, [text, min, max, onChange]);
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        placeholder="min"
        aria-label={`${label}: minimum`}
        value={text.min}
        onChange={(e) => setText((t) => ({ ...t, min: e.target.value }))}
      />
      <span className="text-ink-3">–</span>
      <Input
        type="number"
        min={0}
        step={step}
        inputMode="decimal"
        placeholder="maks"
        aria-label={`${label}: maksimum`}
        value={text.max}
        onChange={(e) => setText((t) => ({ ...t, max: e.target.value }))}
      />
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
        <RangeInputs
          label="Ölçü, hektar"
          min={filters.minHa}
          max={filters.maxHa}
          onChange={(minHa, maxHa) => update({ minHa, maxHa })}
        />
      </div>

      {/* Collapsed by default to keep the map sidebar short; opens itself when a value is set. */}
      <details className="group rounded-md border border-border" open={financeActive(filters) || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-13 font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
          <span>
            Maliyyə şərtləri
            {financeActive(filters) && <span className="ml-1.5 rounded-sm bg-primary-50 px-1.5 text-2xs text-primary">aktiv</span>}
          </span>
          <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-2.5">
          <div>
            <div className="mb-1 text-13 text-ink-2">İllik icarə haqqı (AZN/ha)</div>
            <RangeInputs
              label="İllik icarə haqqı, AZN/ha"
              min={filters.feeMin}
              max={filters.feeMax}
              onChange={(feeMin, feeMax) => update({ feeMin, feeMax })}
            />
          </div>
          <div>
            <div className="mb-1 text-13 text-ink-2">Minimum investisiya (AZN)</div>
            <RangeInputs
              label="Minimum investisiya, AZN"
              step={10000}
              min={filters.invMin}
              max={filters.invMax}
              onChange={(invMin, invMax) => update({ invMin, invMax })}
            />
            <p className="mt-1 text-2xs text-ink-3">Yalnız müsabiqəyə çıxarılmış sahələrə aiddir.</p>
          </div>
        </div>
      </details>

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
