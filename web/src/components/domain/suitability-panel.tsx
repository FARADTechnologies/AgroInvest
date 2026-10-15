"use client";

import { useState } from "react";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import type { Schemas } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

type Suitability = Schemas["SuitabilityOut"];
type Factor = {
  label: string;
  value: number | null;
  unit?: string;
  /** Categorical factors (land cover, relief) carry a text instead of a number. */
  text?: string;
  membership: number;
  weight: number;
};

const BAR: Record<string, string> = { S1: "bg-suit-s1", S2: "bg-suit-s2", S3: "bg-suit-s3", N: "bg-suit-n" };

/**
 * Decision support, never a decision: the score per activity, its FAO class and
 * the factor breakdown that answers "why 78?".
 */
export function SuitabilityPanel({ items, purpose }: { items: Suitability[]; purpose?: string }) {
  const t = useT();
  // Open on the area's own purpose: that is the question the visitor is asking.
  const [active, setActive] = useState(items.find((i) => i.activity === purpose)?.activity ?? items[0]?.activity);
  const current = items.find((i) => i.activity === active) ?? items[0];
  // Heaviest factor first (the stored JSON does not keep key order).
  const factors = Object.entries((current?.factors ?? {}) as Record<string, Factor>)
    .filter(([key]) => !key.startsWith("_"))
    .sort(([, x], [, y]) => y.weight - x.weight);
  const meta = (current?.factors ?? {}) as { _cr?: number; _method?: string };

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>
          {t.suitability.title} <span className="font-normal text-ink-3">· {t.suitability.decisionSupport}</span>
        </PanelTitle>
      </PanelHeader>
      <PanelBody className="space-y-5">
        <div className="space-y-2">
          {items.map((s) => (
            <button
              key={s.activity}
              type="button"
              onClick={() => setActive(s.activity)}
              aria-pressed={s.activity === current?.activity}
              className={cn(
                "grid w-full grid-cols-[120px_1fr_44px_32px] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm",
                s.activity === current?.activity ? "bg-surface-2" : "hover:bg-surface-2/60"
              )}
            >
              <span>{t.purpose[s.activity]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", BAR[s.fao_class])} style={{ width: `${s.score}%` }} />
              </span>
              <span className="tabular text-right font-medium">{s.fao_class === "N" ? "—" : s.score}</span>
              <span className="font-mono text-13 text-ink-2">{s.fao_class}</span>
            </button>
          ))}
        </div>

        {current?.constraint_reason ? (
          <p className="rounded-md bg-status-info-bg px-3 py-2 text-13 text-status-info-fg">
            Uyğun deyil: {current.constraint_reason}
          </p>
        ) : (
          factors.length > 0 && (
            <div>
              <h3 className="text-13 font-medium text-ink-2">
                Niyə {current.score}? · {t.purpose[current.activity]}
              </h3>
              <table className="mt-2 w-full text-13">
                <thead>
                  <tr className="border-b border-border text-left text-ink-3">
                    <th className="py-1.5 font-medium">Amil</th>
                    <th className="py-1.5 text-right font-medium">Dəyər</th>
                    <th className="py-1.5 text-right font-medium">Bal (0–1)</th>
                    <th className="py-1.5 text-right font-medium">Çəki</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {factors.map(([key, f]) => (
                    <tr key={key} className="border-b border-border last:border-b-0">
                      <td className="py-1.5">{f.label}</td>
                      <td className="py-1.5 text-right">
                        {f.text ??
                          (f.value == null
                            ? "—"
                            : `${formatNumber(f.value, f.unit === "km" || f.unit === "°" ? 1 : 0)} ${f.unit ?? ""}`)}
                      </td>
                      <td className="py-1.5 text-right">{formatNumber(f.membership, 2)}</td>
                      <td className="py-1.5 text-right">{formatNumber(f.weight * 100, 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <p className="text-13 text-ink-3">
          Çoxmeyarlı CİS təhlili (AHP çəkiləri{meta._cr != null ? `, CR = ${formatNumber(meta._cr, 2)}` : ""}), FAO
          uyğunluq sinifləri. {t.suitability.finalDecision}.
        </p>
      </PanelBody>
    </Panel>
  );
}
