"use client";

import { useState } from "react";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { type ActivityMethod, saaty, type SuitabilityMethod, useSuitabilityMethod } from "@/features/suitability/api";
import type { Schemas } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

type Suitability = Schemas["SuitabilityOut"];
type Factor = {
  label: string;
  group: string;
  value: number | null;
  unit?: string;
  /** Categorical factors (texture, land cover) carry a text instead of a number. */
  text?: string | null;
  membership: number;
  /** Global weight: group weight × weight inside the group. */
  weight: number;
  local_weight: number;
  contribution: number;
  source: string;
};
type Groups = Record<string, { label: string; weight: number }>;

const BAR: Record<string, string> = { S1: "bg-suit-s1", S2: "bg-suit-s2", S3: "bg-suit-s3", N: "bg-suit-n" };
const SOURCE: Record<string, string> = {
  SYNTHETIC: "nümayiş",
  OSM: "OSM",
  CSV: "fayl",
  EKTIS: "EKTİS"
};
const DECIMALS: Record<string, number> = { km: 1, "°": 1, "°C": 1, "%": 2, "dS/m": 1, "": 1 };

function shown(f: Factor): string {
  if (f.text) return f.text;
  if (f.value == null) return "—";
  const unit = f.unit === "/100" ? "/100" : f.unit ? ` ${f.unit}` : "";
  return `${formatNumber(f.value, DECIMALS[f.unit ?? ""] ?? 0)}${unit}`;
}

/**
 * Decision support, never a decision: the score per activity, its FAO class and the
 * factor breakdown by criteria group that answers "why 78?", with the method behind it.
 */
export function SuitabilityPanel({ items, purpose }: { items: Suitability[]; purpose?: string }) {
  const t = useT();
  const method = useSuitabilityMethod();
  // Open on the area's own purpose: that is the question the visitor is asking.
  const [active, setActive] = useState(items.find((i) => i.activity === purpose)?.activity ?? items[0]?.activity);
  const current = items.find((i) => i.activity === active) ?? items[0];
  const raw = (current?.factors ?? {}) as Record<string, unknown>;
  const groups = (raw._groups ?? {}) as Groups;
  const factors = Object.entries(raw)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, f]) => [key, f as Factor] as const);
  // Groups by weight, factors by contribution inside them: the biggest reasons first.
  const grouped = Object.entries(groups)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .map(([key, g]) => {
      const rows = factors.filter(([, f]) => f.group === key).sort(([, a], [, b]) => b.weight - a.weight);
      return { key, ...g, rows, total: rows.reduce((s, [, f]) => s + f.contribution, 0) };
    });
  const best = items.filter((i) => i.fao_class !== "N").sort((a, b) => b.score - a.score)[0];
  const meta = raw as { _cr?: number; _method?: string };
  const planned = Object.fromEntries((method.data?.factors ?? []).map((f) => [f.key, f.planned_source]));
  const anySynthetic = factors.some(([, f]) => f.source === "SYNTHETIC");

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
                "grid w-full grid-cols-[96px_1fr_32px_28px] items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
                s.activity === current?.activity ? "bg-surface-2" : "hover:bg-surface-2/60"
              )}
            >
              <span>{t.purpose[s.activity]}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", BAR[s.fao_class])} style={{ width: `${s.score}%` }} />
              </span>
              <span className="tabular text-right font-medium">{s.score}</span>
              <span className="font-mono text-13 text-ink-2">{s.fao_class}</span>
            </button>
          ))}
          {best && (
            <p className="px-2 text-13 text-ink-2">
              Ən uyğun fəaliyyət: <span className="font-medium text-ink">{t.purpose[best.activity]}</span> ·{" "}
              {best.score} ({best.fao_class})
            </p>
          )}
        </div>

        {current?.constraint_reason && (
          <p className="rounded-md bg-status-info-bg px-3 py-2 text-13 text-status-info-fg">
            Sinif N: {current.constraint_reason}
          </p>
        )}

        {grouped.length > 0 && (
          <div>
            <h3 className="text-13 font-medium text-ink-2">
              Niyə {current.score}? · {t.purpose[current.activity]}
            </h3>
            <p className="mt-1 text-2xs text-ink-3">Töhfə = 100 × çəki × bal; töhfələrin cəmi balı verir.</p>
            <div className="mt-3 space-y-4">
              {grouped.map((g) => (
                <section key={g.key}>
                  <div className="flex items-baseline justify-between border-b border-border pb-1 text-13">
                    <span className="font-medium">
                      {g.label} <span className="font-normal text-ink-3">· çəki {formatNumber(g.weight * 100, 0)}%</span>
                    </span>
                    <span className="tabular font-medium">+{formatNumber(g.total, 1)}</span>
                  </div>
                  <ul className="tabular">
                    {g.rows.map(([key, f]) => (
                      <li key={key} className="border-b border-border py-1.5 last:border-b-0">
                        <div className="flex items-baseline justify-between gap-3 text-13">
                          <span className="min-w-0">
                            {f.label}
                            {f.source === "SYNTHETIC" && (
                              <span
                                title={`Nümayiş məlumatı (sintetik)${planned[key] ? ` · real mənbə: ${planned[key]}` : ""}`}
                                className="ml-1.5 whitespace-nowrap rounded-sm border border-border px-1 text-2xs text-ink-3"
                              >
                                {SOURCE.SYNTHETIC}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right">{shown(f)}</span>
                        </div>
                        <div className="mt-0.5 flex justify-between text-2xs text-ink-3">
                          <span>
                            bal {formatNumber(f.membership, 2)} · çəki {formatNumber(f.weight * 100, 1)}%
                          </span>
                          <span>+{formatNumber(f.contribution, 1)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {anySynthetic && (
              <p className="mt-3 text-2xs text-ink-3">
                «nümayiş» — torpaq, iqlim və relyef amilləri hazırda sintetik nümayiş məlumatıdır (coğrafiyaya uyğun,
                lakin ölçülməyib). Məsafələr və torpaq örtüyü OpenStreetMap üzrə ölçülüb.
              </p>
            )}
          </div>
        )}

        {current && method.data && <Methodology method={method.data} activity={current.activity} />}

        <p className="text-13 text-ink-3">
          Çoxmeyarlı CİS təhlili (iki səviyyəli AHP{meta._cr != null ? `, CR = ${formatNumber(meta._cr, 2)}` : ""}), FAO
          uyğunluq sinifləri{meta._method ? ` · metod ${meta._method}` : ""}. {t.suitability.finalDecision}.
        </p>
      </PanelBody>
    </Panel>
  );
}

const SHORT: Record<string, string> = { SOIL: "Torp.", CLIMATE: "İql.", TERRAIN: "Rel.", ACCESS: "Su/inf." };

function Methodology({ method, activity }: { method: SuitabilityMethod; activity: string }) {
  const a = method.activities.find((x) => x.activity === activity) as ActivityMethod | undefined;
  if (!a) return null;
  const g = a.groups;
  const sources = method.factors.filter((f) => f.source !== "OSM");
  const measured = method.factors.filter((f) => f.source === "OSM");
  return (
    <details className="group rounded-md border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-13 font-medium">
        Metodologiya <span className="font-normal text-ink-3">· AHP, FAO sinifləri, mənbələr</span>
      </summary>
      <div className="space-y-4 border-t border-border px-3 py-3 text-13">
        <div>
          <h4 className="font-medium">Qrupların cüt-cüt müqayisəsi ({a.label})</h4>
          <p className="mt-0.5 text-2xs text-ink-3">
            Saaty şkalası 1–9: sətir sütundan neçə dəfə vacibdir. Çəkilər matrisin baş məxsusi vektorudur.
          </p>
          <table className="tabular mt-2 w-full text-2xs">
            <thead>
              <tr className="text-ink-3">
                <th className="py-1 text-left font-medium" />
                {g.keys.map((k) => (
                  <th key={k} className="py-1 text-right font-medium">
                    {SHORT[k] ?? k}
                  </th>
                ))}
                <th className="py-1 text-right font-medium">Çəki</th>
              </tr>
            </thead>
            <tbody>
              {g.keys.map((k, i) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-1">{g.labels[i]}</td>
                  {g.matrix[i].map((v, j) => (
                    <td key={j} className={cn("py-1 text-right", i === j && "text-ink-3")}>
                      {saaty(v)}
                    </td>
                  ))}
                  <td className="py-1 text-right font-medium">{formatNumber(g.weights[i] * 100, 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-2xs text-ink-3">
            Uyğunluq nisbəti CR = {formatNumber(g.cr, 3)} (qəbul: CR &lt; {formatNumber(method.max_cr, 1)})
          </p>
        </div>

        <div>
          <h4 className="font-medium">Qrup daxilində amil çəkiləri</h4>
          <ul className="mt-1 space-y-1 text-2xs">
            {g.keys.map((k, i) => {
              const fm = a.factors[k];
              if (!fm) return null;
              return (
                <li key={k}>
                  <span className="font-medium">{g.labels[i]}</span>{" "}
                  <span className="text-ink-3">(CR {formatNumber(fm.cr, 3)})</span>:{" "}
                  {fm.keys.map((f, j) => `${fm.labels[j]} ${formatNumber(fm.weights[j] * 100, 0)}%`).join(", ")}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 className="font-medium">FAO uyğunluq sinifləri</h4>
          <p className="mt-1 text-2xs">
            S1 ≥ {method.thresholds.S1} · S2 ≥ {method.thresholds.S2} · S3 ≥ {method.thresholds.S3} · N &lt;{" "}
            {method.thresholds.S3}
          </p>
          <p className="mt-1 text-2xs text-ink-3">
            Sərt məhdudiyyətlər (bal nə olursa olsun N): minatəmizləmə başa çatmayıb; bağçılıq üçün ağır şoranlaşma
            (EC &gt; 6 dS/m).
          </p>
        </div>

        <div>
          <h4 className="font-medium">Məlumat mənbələri</h4>
          <ul className="mt-1 space-y-0.5 text-2xs">
            {sources.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span>
                  {f.label}{" "}
                  <span className="text-ink-3">· {f.source === "SYNTHETIC" ? "nümayiş (sintetik)" : f.source_label}</span>
                </span>
                <span className="text-right text-ink-3">→ {f.planned_source}</span>
              </li>
            ))}
            <li className="pt-1 text-ink-3">
              Ölçülüb: {measured.map((f) => f.label.toLowerCase()).join(", ")} — OpenStreetMap, PostGIS.
            </li>
          </ul>
        </div>
        <p className="text-2xs text-ink-3">Metod versiyası {method.version}</p>
      </div>
    </details>
  );
}
