"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleCheck, Scale, TriangleAlert } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { api, type Schemas, unwrap } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

type Activity = "CROP" | "ORCHARD" | "LIVESTOCK";
type Preset = "balanced" | "suitability" | "cost" | "access";
type RankOut = Schemas["RankOut"];

const PRESETS: { key: Preset; label: string; weights: Record<string, number> }[] = [
  { key: "balanced", label: "Balanslı", weights: { suitability: 3, fee: 2, investment: 2, water: 1.5, road: 1.5 } },
  { key: "suitability", label: "Uyğunluq önəmlidir", weights: { suitability: 5, fee: 1.5, investment: 1.5, water: 1, road: 1 } },
  { key: "cost", label: "Xərc önəmlidir", weights: { suitability: 2, fee: 3.5, investment: 3, water: 0.75, road: 0.75 } },
  { key: "access", label: "Əlçatanlıq önəmlidir", weights: { suitability: 2, fee: 1, investment: 1, water: 3, road: 3 } }
];

const CRITERIA_LABEL: Record<string, string> = {
  suitability: "Uyğunluq balı",
  fee: "İllik icarə haqqı",
  investment: "Minimum investisiya",
  water: "Su mənbəyinə məsafə",
  road: "Əsas yola məsafə"
};

function useRanking(codes: string[], activity: Activity, preset: Preset | null, weights: Record<string, number>) {
  return useQuery({
    queryKey: ["compare-rank", codes, activity, preset, preset ? null : weights],
    queryFn: () =>
      unwrap(
        api.POST("/api/v1/areas/compare/rank", {
          body: { codes, activity, preset, weights: preset ? null : weights }
        })
      ),
    enabled: codes.length >= 2,
    placeholderData: keepPreviousData
  });
}

/**
 * "Which plot fits better?" A transparent ranking (TOPSIS) with weights the user sets,
 * a per-criterion table and a check of how stable the first place is.
 */
export function DecisionSupport({ codes, defaultActivity }: { codes: string[]; defaultActivity: Activity }) {
  const t = useT();
  const [activity, setActivity] = useState<Activity>(defaultActivity);
  const [preset, setPreset] = useState<Preset | null>("balanced");
  const [weights, setWeights] = useState<Record<string, number>>(PRESETS[0].weights);
  const deferred = useDeferredValue(weights);
  const { data, isLoading, isFetching } = useRanking(codes, activity, preset, deferred);
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const choosePreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.key);
    setWeights(p.weights);
  };

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-2">
        <PanelTitle className="flex items-center gap-2">
          <Scale className="size-4 text-ink-3" aria-hidden /> Hansı sahə daha uyğundur?
          <span className="font-normal text-ink-3">· Qərar dəstəyi</span>
        </PanelTitle>
        {isFetching && <span className="text-13 text-ink-3">Hesablanır…</span>}
      </PanelHeader>
      <PanelBody className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4">
            <label className="grid gap-1 text-13 font-medium text-ink-2">
              Fəaliyyət
              <select
                className="h-9 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-ink"
                value={activity}
                onChange={(e) => setActivity(e.target.value as Activity)}
              >
                {(["CROP", "ORCHARD", "LIVESTOCK"] as const).map((a) => (
                  <option key={a} value={a}>
                    {t.purpose[a]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1.5 text-13 font-medium text-ink-2">Prioritet</div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={preset === p.key}
                    onClick={() => choosePreset(p)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-13",
                      preset === p.key ? "border-primary bg-primary-50 font-medium text-primary" : "border-border text-ink-2 hover:bg-surface-2"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                {preset === null && (
                  <span className="rounded-md border border-primary bg-primary-50 px-2.5 py-1 text-13 font-medium text-primary">Fərdi</span>
                )}
              </div>
            </div>
            <div className="space-y-2.5">
              {Object.keys(CRITERIA_LABEL).map((key) => (
                <label key={key} className="block text-13">
                  <span className="flex justify-between text-ink-2">
                    {CRITERIA_LABEL[key]}
                    <span className="tabular text-ink">{formatNumber((100 * (weights[key] ?? 0)) / total)}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={weights[key] ?? 0}
                    onChange={(e) => {
                      setPreset(null);
                      setWeights((w) => ({ ...w, [key]: Number(e.target.value) }));
                    }}
                    className="w-full accent-[rgb(var(--primary))]"
                    aria-label={`${CRITERIA_LABEL[key]}: çəki`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            {isLoading || !data ? <Skeleton className="h-64" /> : <Result data={data} />}
          </div>
        </div>
        {data && <p className="text-13 text-ink-3">{data.note}</p>}
      </PanelBody>
    </Panel>
  );
}

function Result({ data }: { data: RankOut }) {
  const ranked = data.ranking.filter((r) => r.rank);
  const codes = data.ranking.map((r) => r.code);
  return (
    <>
      <ol className="space-y-2">
        {ranked.map((r) => (
          <li key={r.code} className="grid grid-cols-[28px_minmax(0,1fr)_120px_44px] items-center gap-3 text-sm">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-13 font-semibold tabular",
                r.rank === 1 ? "bg-primary text-primary-fg" : "bg-surface-2 text-ink-2"
              )}
            >
              {r.rank}
            </span>
            <span className="min-w-0 truncate">
              <span className="font-mono text-13 text-ink-3">{r.code}</span> {r.name_az}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="block h-full rounded-r-[4px] bg-primary" style={{ width: `${(r.closeness ?? 0) * 100}%` }} />
            </span>
            <span className="tabular text-right font-medium">{formatNumber(r.closeness ?? 0, 2)}</span>
          </li>
        ))}
        {data.ranking
          .filter((r) => !r.rank)
          .map((r) => (
            <li key={r.code} className="text-13 text-ink-2">
              <span className="font-mono">{r.code}</span> sıralamaya daxil edilmədi: {r.excluded_reason}
            </li>
          ))}
      </ol>

      <div
        className={cn(
          "flex items-start gap-2 rounded-md px-3 py-2 text-13",
          data.stable ? "bg-status-won-bg text-status-won-fg" : "bg-status-info-bg text-status-info-fg"
        )}
      >
        {data.stable ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
        <span>
          {data.stable ? "Sıralama sabitdir" : "Sıralama çəkilərə həssasdır"}: çəkilər ±20% dəyişdikdə ssenarilərin{" "}
          {formatNumber(data.stability * 100)}%-də birinci yer dəyişmir.
        </span>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-13 text-ink-2">
        {data.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-13">
          <thead>
            <tr className="border-b border-border text-left text-ink-3">
              <th className="py-1.5 pr-3 font-medium">Meyar</th>
              <th className="py-1.5 pr-3 text-right font-medium">Çəki</th>
              {codes.map((c) => (
                <th key={c} className="py-1.5 pr-3 font-mono font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {data.criteria.map((c) => (
              <tr key={c.key} className="border-b border-border last:border-b-0">
                <td className="py-1.5 pr-3">
                  {c.label}
                  <span className="ml-1 text-2xs text-ink-3">{c.benefit ? "çox olsa yaxşı" : "az olsa yaxşı"}</span>
                </td>
                <td className="py-1.5 pr-3 text-right">{formatNumber(c.weight * 100)}%</td>
                {codes.map((code) => {
                  const v = c.values[code];
                  return (
                    <td key={code} className={cn("py-1.5 pr-3", v?.best ? "font-medium text-ink" : "text-ink-2")}>
                      <span className="inline-flex items-center gap-1">
                        {v?.best && <CircleCheck className="size-3.5 text-status-won-fg" aria-label="ən yaxşı" />}
                        {v?.display}
                      </span>
                      {v?.imputed && <span className="block text-2xs text-ink-3">ən pis dəyər götürülüb</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
