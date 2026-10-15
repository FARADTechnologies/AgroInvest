"use client";

import { useState } from "react";

import { formatNumber } from "@/lib/utils";

export type ColumnDatum = { key: string; label: string; value: number };

const HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const PAD_LEFT = 28;

/**
 * Daily counts as columns: one hue, columns capped at 24 px with a 2 px gap,
 * hairline grid, a tooltip per column (the whole slot is the hit target) and a
 * visually hidden table carrying the same numbers.
 */
export function ColumnChart({ data, title, unit }: { data: ColumnDatum[]; title: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  // Clean ticks: 0, half, max rounded up to a whole number.
  const top = Math.max(2, Math.ceil(max / 2) * 2);
  const ticks = [0, top / 2, top];
  const width = 640;
  const plotW = width - PAD_LEFT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const slot = plotW / data.length;
  const barW = Math.min(24, slot - 2);
  const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={width} y1={y(t)} y2={y(t)} stroke="rgb(var(--border))" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-3 text-[11px] tabular">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD_LEFT + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h / 2);
          return (
            <g
              key={d.key}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${d.label}: ${d.value} ${unit}`}
            >
              <rect x={PAD_LEFT + i * slot} y={PAD_TOP} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`}
                  className="fill-primary"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {/* Weekly date labels; the last day only when it cannot collide with the previous one. */}
              {(i % 7 === 0 || (i === data.length - 1 && i % 7 >= 4)) && (
                <text x={PAD_LEFT + i * slot + slot / 2} y={HEIGHT - 6} textAnchor="middle" className="fill-ink-3 text-[11px]">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-3xl border border-border/70 bg-surface shadow-card px-2.5 py-1.5 text-13 shadow-popover"
          style={{ left: `${((PAD_LEFT + hover * slot + slot / 2) / width) * 100}%`, top: 0 }}
        >
          <div className="font-semibold tabular text-ink">
            {formatNumber(data[hover].value)} {unit}
          </div>
          <div className="text-ink-3">{data[hover].label}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
