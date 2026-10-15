import { formatAzn, formatNumber } from "@/lib/utils";

/** Large sums read better compacted: 8,9 mln AZN. */
export function compactAzn(v: number): string {
  if (v >= 1_000_000) return `${formatNumber(v / 1_000_000, 1)} mln AZN`;
  return formatAzn(v);
}

/** A headline figure: a stat tile, not a chart. */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="text-13 text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {note && <div className="mt-0.5 text-13 text-ink-3">{note}</div>}
    </div>
  );
}
