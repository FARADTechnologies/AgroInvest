"use client";

import { CircleAlert, CircleCheck, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useSession } from "@/features/auth/use-session";
import {
  ahp,
  type MethodInput,
  saaty,
  SAATY_SCALE,
  type SuitabilityMethod,
  useDefaultMethod,
  useMethodVersions,
  usePublishMethod,
  useSuitabilityMethod
} from "@/features/suitability/api";
import { ApiError } from "@/lib/api/client";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

const MAX_CR = 0.1;

type Matrix = { keys: string[]; labels: string[]; matrix: number[][] };
type Draft = Record<string, { label: string; groups: Matrix; factors: Record<string, Matrix> }>;

function toDraft(method: SuitabilityMethod): Draft {
  return Object.fromEntries(
    method.activities.map((a) => [
      a.activity,
      {
        label: a.label,
        groups: { keys: a.groups.keys, labels: a.groups.labels, matrix: a.groups.matrix },
        factors: Object.fromEntries(
          Object.entries(a.factors).map(([g, m]) => [g, { keys: m.keys, labels: m.labels, matrix: m.matrix }])
        )
      }
    ])
  );
}

function toInput(draft: Draft, comment: string): MethodInput {
  const strip = (m: Matrix) => ({ keys: m.keys, matrix: m.matrix });
  return {
    comment,
    matrices: Object.fromEntries(
      Object.entries(draft).map(([a, d]) => [
        a,
        { groups: strip(d.groups), factors: Object.fromEntries(Object.entries(d.factors).map(([g, m]) => [g, strip(m)])) }
      ])
    )
  };
}

/** Every matrix of an activity with its live weights and CR. */
function evaluate(d: Draft[string]) {
  const groups = ahp(d.groups.matrix);
  const factors = Object.fromEntries(Object.entries(d.factors).map(([g, m]) => [g, ahp(m.matrix)]));
  const crs = [groups.cr, ...Object.values(factors).map((f) => f.cr)];
  return { groups, factors, maxCr: Math.max(...crs) };
}

/** Compares drafts by the Saaty values an expert sees, not by floating-point noise. */
function signature(draft: Draft): string {
  const sig = (m: Matrix) => m.matrix.map((row) => row.map(saaty).join(",")).join(";");
  // Sorted: the database does not keep the key order of the stored matrices.
  return Object.keys(draft)
    .sort()
    .map((a) => {
      const d = draft[a];
      return [sig(d.groups), ...Object.keys(d.factors).sort().map((g) => sig(d.factors[g]))].join("|");
    })
    .join("#");
}

function nearest(value: number) {
  return SAATY_SCALE.reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best), 1);
}

function MatrixEditor({
  m,
  short,
  readOnly,
  onChange
}: {
  m: Matrix;
  short?: Record<string, string>;
  readOnly: boolean;
  onChange: (i: number, j: number, value: number) => void;
}) {
  const { weights, cr } = ahp(m.matrix);
  const n = m.keys.length;
  if (n === 1) {
    return <p className="text-13 text-ink-3">Tək amil: {m.labels[0]} · çəki 100%</p>;
  }
  const ok = cr < MAX_CR;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-13">
          <thead>
            <tr className="text-ink-3">
              <th className="py-1.5 pr-2 text-left font-medium" />
              {m.keys.map((k, j) => (
                <th key={k} className="px-1 py-1.5 text-center font-medium" title={m.labels[j]}>
                  {short?.[k] ?? m.labels[j].split(" ")[0]}
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-medium">Çəki</th>
            </tr>
          </thead>
          <tbody>
            {m.keys.map((k, i) => (
              <tr key={k} className="border-t border-border">
                <td className="py-1 pr-2">{m.labels[i]}</td>
                {m.matrix[i].map((v, j) => (
                  <td key={j} className="px-1 py-1 text-center">
                    {j > i && !readOnly ? (
                      <select
                        aria-label={`${m.labels[i]} — ${m.labels[j]}`}
                        value={String(nearest(v))}
                        onChange={(e) => onChange(i, j, Number(e.target.value))}
                        className="h-7 w-14 rounded-md border border-border bg-surface px-1 text-center text-13"
                      >
                        {SAATY_SCALE.map((s) => (
                          <option key={s} value={String(s)}>
                            {saaty(s)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn(i === j || j < i ? "text-ink-3" : "")}>{saaty(v)}</span>
                    )}
                  </td>
                ))}
                <td className="py-1 pl-2 text-right font-medium">{formatNumber(weights[i] * 100, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={cn("mt-2 flex items-center gap-1.5 text-13", ok ? "text-ink-2" : "text-danger")}>
        {ok ? <CircleCheck className="size-4 text-primary" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
        CR = {formatNumber(cr, 3)} {ok ? "· ardıcıldır" : "≥ 0,1 · matris ziddiyyətlidir, saxlamaq olmaz"}
      </p>
    </div>
  );
}

const SHORT: Record<string, string> = { SOIL: "Torp.", CLIMATE: "İql.", TERRAIN: "Rel.", ACCESS: "Su/inf." };

export default function SuitabilityMethodPage() {
  const { data: user } = useSession();
  const canEdit = user?.role === "SPECIALIST" || user?.role === "ADMIN";
  const method = useSuitabilityMethod();
  const versions = useMethodVersions();
  const [wantDefault, setWantDefault] = useState(false);
  const standard = useDefaultMethod(wantDefault);
  const publish = usePublishMethod();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [activity, setActivity] = useState("CROP");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (method.data && !draft) setDraft(toDraft(method.data));
  }, [method.data, draft]);
  useEffect(() => {
    if (wantDefault && standard.data) {
      setDraft(toDraft(standard.data));
      setWantDefault(false);
    }
  }, [wantDefault, standard.data]);

  const evaluated = useMemo(
    () => (draft ? Object.fromEntries(Object.entries(draft).map(([a, d]) => [a, evaluate(d)])) : {}),
    [draft]
  );
  const dirty = !!draft && !!method.data && signature(draft) !== signature(toDraft(method.data));
  const inconsistent = Object.entries(evaluated)
    .filter(([, e]) => e.maxCr >= MAX_CR)
    .map(([a]) => draft?.[a].label);

  if (!draft || !method.data) {
    return <Skeleton className="h-96" />;
  }
  const current = draft[activity];
  const ev = evaluated[activity];

  function update(target: "groups" | string, i: number, j: number, value: number) {
    setDraft((d) => {
      if (!d) return d;
      const next = structuredClone(d);
      const m = target === "groups" ? next[activity].groups : next[activity].factors[target];
      m.matrix[i][j] = value;
      m.matrix[j][i] = 1 / value;
      return next;
    });
    publish.reset();
  }

  const globals = current.groups.keys
    .flatMap((g, gi) =>
      (current.factors[g]?.keys ?? []).map((f, fi) => ({
        key: f,
        label: current.factors[g].labels[fi],
        group: current.groups.labels[gi],
        weight: ev.groups.weights[gi] * ev.factors[g].weights[fi]
      }))
    )
    .sort((a, b) => b.weight - a.weight);
  const err = publish.error instanceof ApiError ? publish.error : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl">Uyğunluq metodologiyası</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Hər fəaliyyət növü üçün ekspertlər meyar qruplarını, sonra qrup daxilində amilləri cüt-cüt müqayisə edir (Saaty
          şkalası 1–9). Çəkilər matrisin baş məxsusi vektorudur; uyğunluq nisbəti CR 0,1-dən kiçik olmalıdır. Yeni versiya
          saxlananda bütün sahələr yenidən qiymətləndirilir və dəyişiklik audit jurnalına yazılır.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(draft).map(([a, d]) => {
          const bad = evaluated[a].maxCr >= MAX_CR;
          return (
            <button
              key={a}
              type="button"
              onClick={() => setActivity(a)}
              aria-pressed={a === activity}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
                a === activity ? "border-primary bg-primary-50 font-medium text-primary" : "border-border hover:bg-surface-2"
              )}
            >
              {d.label}
              {bad && <CircleAlert className="size-4 text-danger" aria-label="CR ≥ 0,1" />}
            </button>
          );
        })}
        <span className="ml-auto text-13 text-ink-3">
          Aktiv versiya: <span className="font-medium text-ink">{method.data.version}</span>
          {dirty && " · saxlanmamış dəyişikliklər var"}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>Meyar qrupları · {current.label}</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p className="mb-3 text-13 text-ink-3">Sətir sütundan neçə dəfə vacibdir: 1 — bərabər, 3 — bir az, 5 — xeyli, 9 — mütləq.</p>
              <MatrixEditor m={current.groups} short={SHORT} readOnly={!canEdit} onChange={(i, j, v) => update("groups", i, j, v)} />
            </PanelBody>
          </Panel>
          <div className="grid gap-5 2xl:grid-cols-2">
            {current.groups.keys.map((g, gi) =>
              current.factors[g] ? (
                <Panel key={g}>
                  <PanelHeader>
                    <PanelTitle>
                      {current.groups.labels[gi]}{" "}
                      <span className="font-normal text-ink-3">· qrup çəkisi {formatNumber(ev.groups.weights[gi] * 100, 0)}%</span>
                    </PanelTitle>
                  </PanelHeader>
                  <PanelBody>
                    <MatrixEditor m={current.factors[g]} readOnly={!canEdit} onChange={(i, j, v) => update(g, i, j, v)} />
                  </PanelBody>
                </Panel>
              ) : null
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader>
              <PanelTitle>Yekun amil çəkiləri</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <ul className="space-y-1.5 text-13">
                {globals.map((f) => (
                  <li key={f.key}>
                    <div className="flex justify-between gap-3">
                      <span>
                        {f.label} <span className="text-ink-3">· {f.group}</span>
                      </span>
                      <span className="tabular font-medium">{formatNumber(f.weight * 100, 1)}%</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, f.weight * 250)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          {canEdit && (
            <Panel>
              <PanelHeader>
                <PanelTitle>Yeni versiya</PanelTitle>
              </PanelHeader>
              <PanelBody className="space-y-3">
                <Textarea
                  id="method-comment"
                  aria-label="Dəyişikliyin əsaslandırılması"
                  placeholder="Dəyişikliyin əsaslandırılması (məs.: ekspert şurasının 15.10 qərarı)"
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {inconsistent.length > 0 && (
                  <p className="text-13 text-danger">Ziddiyyətli matris: {inconsistent.join(", ")}. CR &lt; 0,1 olmalıdır.</p>
                )}
                {err && <p className="text-13 text-danger">{err.message}</p>}
                {publish.data && (
                  <p className="rounded-md bg-status-won-bg px-3 py-2 text-13 text-status-won-fg">
                    {publish.data.version} yayımlandı · {publish.data.rescored} sahə yenidən qiymətləndirildi ·{" "}
                    {publish.data.class_changes} nəticənin FAO sinfi dəyişdi.
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={!dirty || inconsistent.length > 0 || comment.trim().length < 3 || publish.isPending}
                  onClick={() =>
                    // The draft is what was published, so it matches the new version once refetched.
                    publish.mutate(toInput(draft, comment.trim()), { onSuccess: () => setComment("") })
                  }
                >
                  {publish.isPending ? "Sahələr yenidən qiymətləndirilir…" : "Yeni versiya kimi saxla"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    disabled={!dirty}
                    onClick={() => setDraft(toDraft(method.data!))}
                  >
                    <RotateCcw aria-hidden /> Aktiv versiyaya qaytar
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setWantDefault(true)}>
                    Standart matrislər
                  </Button>
                </div>
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader>
              <PanelTitle>Versiyalar</PanelTitle>
            </PanelHeader>
            <PanelBody className="p-0">
              <ul className="divide-y divide-border text-13">
                {(versions.data ?? []).map((v) => (
                  <li key={v.version} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{v.version}</span>
                      {v.active && (
                        <span className="rounded-full bg-status-won-bg px-2 text-2xs font-medium leading-5 text-status-won-fg">
                          aktiv
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-ink-3">
                      {formatDateTime(v.created_at)} · {v.created_by ?? "sistem"} · maks. CR {formatNumber(v.max_cr, 3)}
                    </div>
                    {v.comment && <div className="mt-0.5 text-ink-2">{v.comment}</div>}
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}
