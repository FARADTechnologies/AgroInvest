import { cn, formatNumber } from "@/lib/utils";

export type BarItem = {
  key: string;
  label: React.ReactNode;
  value: number;
  /** Extra columns shown after the value (already formatted). */
  extra?: React.ReactNode[];
  /** Plain-text name for the tooltip and screen readers. */
  name: string;
};

/**
 * Horizontal bars for comparing magnitude across categories.
 * One hue for every bar (identity comes from the label beside it), thin marks
 * with a rounded data-end, the value at the tip.
 */
export function BarList({
  items,
  valueLabel,
  extraHeaders = [],
  format = (v: number) => formatNumber(v),
  className
}: {
  items: BarItem[];
  valueLabel: string;
  extraHeaders?: string[];
  format?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <table className={cn("w-full text-13", className)}>
      <thead>
        <tr className="text-left text-ink-3">
          <th className="pb-2 font-medium" />
          <th className="pb-2 font-medium">{valueLabel}</th>
          {extraHeaders.map((h) => (
            <th key={h} className="pb-2 text-right font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular">
        {items.map((item) => (
          <tr key={item.key} className="group" title={`${item.name}: ${format(item.value)}`}>
            <td className="w-[1%] whitespace-nowrap py-1.5 pr-4 align-middle">{item.label}</td>
            <td className="w-full py-1.5 align-middle">
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1">
                  <div
                    className="h-full rounded-r-[4px] bg-primary transition-opacity group-hover:opacity-80"
                    style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? 3 : 0 }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-medium text-ink">{format(item.value)}</span>
              </div>
            </td>
            {item.extra?.map((e, i) => (
              <td key={i} className="whitespace-nowrap py-1.5 pl-4 text-right text-ink-2">{e}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
