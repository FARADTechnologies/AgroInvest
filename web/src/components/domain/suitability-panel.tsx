"use client";

import { useState } from "react";

import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { type ActivityMethod, saaty, type SuitabilityMethod, useSuitabilityMethod } from "@/features/suitability/api";
import type { Schemas } from "@/lib/api/client";
import { useL, useT } from "@/lib/i18n";
import { type SuitabilityNames, useSuitabilityNames } from "@/lib/suitability-labels";
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
type Lx = (az: string, en: string) => string;

const BAR: Record<string, string> = { S1: "bg-suit-s1", S2: "bg-suit-s2", S3: "bg-suit-s3", N: "bg-suit-n" };
const DECIMALS: Record<string, number> = { km: 1, "°": 1, "°C": 1, "%": 2, "dS/m": 1, "": 1 };

function shown(f: Factor, names: SuitabilityNames): string {
  if (f.text) return names.text(f.text);
  if (f.value == null) return "—";
  const unit = f.unit === "/100" ? "/100" : f.unit ? ` ${names.unit(f.unit)}` : "";
  return `${formatNumber(f.value, DECIMALS[f.unit ?? ""] ?? 0)}${unit}`;
}

/**
 * Decision support, never a decision: the score per activity, its FAO class and the
 * factor breakdown by criteria group that answers "why 78?", with the method behind it.
 */
export function SuitabilityPanel({ items, purpose }: { items: Suitability[]; purpose?: string }) {
  const t = useT();
  const L = useL();
  const names = useSuitabilityNames();
  const method = useSuitabilityMethod();
  // Open on the plot's own purpose: that is the question the visitor is asking.
  const [active, setActive] = useState(items.find((i) => i.activity === purpose)?.activity ?? items[0]?.activity);
  const current = items.find((i) => i.activity === active) ?? items[0];
  const raw = (current?.factors ?? {}) as Record<string, unknown>;
  const groups = (raw._groups ?? {}) as Groups;
  const factors = Object.entries(raw)
    .filter(([key]) => !key.startsWith("_"))
    .map(([key, f]) => [key, f as Factor] as const);
  // Groups by weight, factors by weight inside them: the biggest reasons first.
  const grouped = Object.entries(groups)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .map(([key, g]) => {
      const rows = factors.filter(([, f]) => f.group === key).sort(([, a], [, b]) => b.weight - a.weight);
      return { key, ...g, rows, total: rows.reduce((s, [, f]) => s + f.contribution, 0) };
    });
  const best = items.filter((i) => i.fao_class !== "N").sort((a, b) => b.score - a.score)[0];
  const meta = raw as { _cr?: number; _method?: string };
  const planned = Object.fromEntries(
    (method.data?.factors ?? []).map((f) => [f.key, names.planned(f.key, f.planned_source)])
  );
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
                "grid w-full grid-cols-[120px_1fr_44px_32px] items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm",
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
          {best && (
            <p className="px-2 text-13 text-ink-2">
              {L("Ən uyğun fəaliyyət", "Best fit")}: <span className="font-medium text-ink">{t.purpose[best.activity]}</span>{" "}
              · {best.score} ({best.fao_class})
            </p>
          )}
        </div>

        {current?.constraint_reason && (
          <p className="rounded-xl bg-status-info-bg px-3 py-2 text-13 text-status-info-fg">
            {L("Sinif N", "Class N")}: {names.text(current.constraint_reason)}
          </p>
        )}

        {grouped.length > 0 && (
          <div>
            <h3 className="text-13 font-medium text-ink-2">
              {L("Niyə", "Why")} {current.score}? · {t.purpose[current.activity]}
            </h3>
            <p className="mt-1 text-2xs text-ink-3">
              {L(
                "Töhfə = 100 × çəki × bal; töhfələrin cəmi balı verir.",
                "Contribution = 100 × weight × score; the contributions add up to the total."
              )}
            </p>
            <div className="mt-3 space-y-4">
              {grouped.map((g) => (
                <section key={g.key}>
                  <div className="flex items-baseline justify-between border-b border-border pb-1 text-13">
                    <span className="font-medium">
                      {names.group(g.key, g.label)}{" "}
                      <span className="font-normal text-ink-3">
                        · {L("çəki", "weight")} {formatNumber(g.weight * 100, 0)}%
                      </span>
                    </span>
                    <span className="tabular font-medium">+{formatNumber(g.total, 1)}</span>
                  </div>
                  <ul className="tabular">
                    {g.rows.map(([key, f]) => (
                      <li key={key} className="border-b border-border py-1.5 last:border-b-0">
                        <div className="flex items-baseline justify-between gap-3 text-13">
                          <span className="min-w-0">
                            {names.factor(key, f.label)}
                            {f.source === "SYNTHETIC" && (
                              <span
                                title={
                                  L("Nümayiş məlumatı (sintetik)", "Demo data (synthetic)") +
                                  (planned[key] ? ` · ${L("real mənbə", "real source")}: ${planned[key]}` : "")
                                }
                                className="ml-1.5 whitespace-nowrap rounded-full border border-border px-1.5 text-2xs text-ink-3"
                              >
                                {L("nümayiş", "demo")}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right">{shown(f, names)}</span>
                        </div>
                        <div className="mt-0.5 flex justify-between text-2xs text-ink-3">
                          <span>
                            {L("bal", "score")} {formatNumber(f.membership, 2)} · {L("çəki", "weight")}{" "}
                            {formatNumber(f.weight * 100, 1)}%
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
                {L(
                  "«nümayiş» — torpaq, iqlim və relyef amilləri hazırda sintetik nümayiş məlumatıdır (coğrafiyaya uyğun, lakin ölçülməyib). Məsafələr və torpaq örtüyü OpenStreetMap üzrə ölçülüb.",
                  "“demo” — soil, climate and terrain factors are synthetic demo data for now (shaped by the geography, but not measured). Distances and land cover are measured from OpenStreetMap."
                )}
              </p>
            )}
          </div>
        )}

        {current && method.data && (
          <Methodology method={method.data} activity={current.activity} L={L} names={names} />
        )}

        <p className="text-13 text-ink-3">
          {L("Çoxmeyarlı CİS təhlili (iki səviyyəli AHP", "Multi-criteria GIS analysis (two-level AHP")}
          {meta._cr != null ? `, CR = ${formatNumber(meta._cr, 2)}` : ""}), {L("FAO uyğunluq sinifləri", "FAO suitability classes")}
          {meta._method ? ` · ${L("metod", "method")} ${meta._method}` : ""}. {t.suitability.finalDecision}.
        </p>
      </PanelBody>
    </Panel>
  );
}

function Methodology({
  method,
  activity,
  L,
  names
}: {
  method: SuitabilityMethod;
  activity: string;
  L: Lx;
  names: SuitabilityNames;
}) {
  const a = method.activities.find((x) => x.activity === activity) as ActivityMethod | undefined;
  if (!a) return null;
  const g = a.groups;
  const short: Record<string, string> = {
    SOIL: L("Torp.", "Soil"),
    CLIMATE: L("İql.", "Clim."),
    TERRAIN: L("Rel.", "Terr."),
    ACCESS: L("Su/inf.", "Access")
  };
  const sources = method.factors.filter((f) => f.source !== "OSM");
  const measured = method.factors.filter((f) => f.source === "OSM");
  return (
    <details className="group rounded-xl border border-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-13 font-medium">
        {L("Metodologiya", "Methodology")}{" "}
        <span className="font-normal text-ink-3">· {L("AHP, FAO sinifləri, mənbələr", "AHP, FAO classes, sources")}</span>
      </summary>
      <div className="space-y-4 border-t border-border px-3 py-3 text-13">
        <div>
          <h4 className="font-medium">
            {L("Qrupların cüt-cüt müqayisəsi", "Pairwise comparison of the groups")} ({names.activity(activity, a.label)})
          </h4>
          <p className="mt-0.5 text-2xs text-ink-3">
            {L(
              "Saaty şkalası 1–9: sətir sütundan neçə dəfə vacibdir. Çəkilər matrisin baş məxsusi vektorudur.",
              "Saaty scale 1–9: how much more the row matters than the column. The weights are the matrix's principal eigenvector."
            )}
          </p>
          <table className="tabular mt-2 w-full text-2xs">
            <thead>
              <tr className="text-ink-3">
                <th className="py-1 text-left font-medium" />
                {g.keys.map((k) => (
                  <th key={k} className="py-1 text-right font-medium">
                    {short[k] ?? k}
                  </th>
                ))}
                <th className="py-1 text-right font-medium">{L("Çəki", "Weight")}</th>
              </tr>
            </thead>
            <tbody>
              {g.keys.map((k, i) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-1">{names.group(k, g.labels[i])}</td>
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
            {L("Uyğunluq nisbəti", "Consistency ratio")} CR = {formatNumber(g.cr, 3)} ({L("qəbul", "accepted")}: CR &lt;{" "}
            {formatNumber(method.max_cr, 1)})
          </p>
        </div>

        <div>
          <h4 className="font-medium">{L("Qrup daxilində amil çəkiləri", "Factor weights within each group")}</h4>
          <ul className="mt-1 space-y-1 text-2xs">
            {g.keys.map((k, i) => {
              const fm = a.factors[k];
              if (!fm) return null;
              return (
                <li key={k}>
                  <span className="font-medium">{names.group(k, g.labels[i])}</span>{" "}
                  <span className="text-ink-3">(CR {formatNumber(fm.cr, 3)})</span>:{" "}
                  {fm.keys
                    .map((f, j) => `${names.factor(f, fm.labels[j])} ${formatNumber(fm.weights[j] * 100, 0)}%`)
                    .join(", ")}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 className="font-medium">{L("FAO uyğunluq sinifləri", "FAO suitability classes")}</h4>
          <p className="mt-1 text-2xs">
            S1 ≥ {method.thresholds.S1} · S2 ≥ {method.thresholds.S2} · S3 ≥ {method.thresholds.S3} · N &lt;{" "}
            {method.thresholds.S3}
          </p>
          <p className="mt-1 text-2xs text-ink-3">
            {L(
              "Sərt məhdudiyyətlər (bal nə olursa olsun N): minatəmizləmə başa çatmayıb; bağçılıq üçün ağır şoranlaşma (EC > 6 dS/m).",
              "Hard constraints (N whatever the score): demining not finished; severe salinity for orchards (EC > 6 dS/m)."
            )}
          </p>
        </div>

        <div>
          <h4 className="font-medium">{L("Məlumat mənbələri", "Data sources")}</h4>
          <ul className="mt-1 space-y-0.5 text-2xs">
            {sources.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span>
                  {names.factor(f.key, f.label)}{" "}
                  <span className="text-ink-3">
                    · {f.source === "SYNTHETIC" ? L("nümayiş (sintetik)", "demo (synthetic)") : f.source_label}
                  </span>
                </span>
                <span className="text-right text-ink-3">→ {names.planned(f.key, f.planned_source)}</span>
              </li>
            ))}
            <li className="pt-1 text-ink-3">
              {L("Ölçülüb", "Measured")}: {measured.map((f) => names.factor(f.key, f.label).toLowerCase()).join(", ")} —
              OpenStreetMap, PostGIS.
            </li>
          </ul>
        </div>
        <p className="text-2xs text-ink-3">
          {L("Metod versiyası", "Method version")} {method.version}
        </p>
      </div>
    </details>
  );
}
