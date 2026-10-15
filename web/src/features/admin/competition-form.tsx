"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { ApiError } from "@/lib/api/client";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { cn, formatHectares, formatNumber } from "@/lib/utils";

import { type AdminCompetition, type CompetitionInput, useAdminAreas, useDocumentTypes } from "./api";

// Suggested minimum investment per hectare; the same figures the seed uses.
const MIN_PER_HA: Record<Purpose, number> = { CROP: 2500, ORCHARD: 6000, LIVESTOCK: 1500, OTHER: 40000 };
const DEFAULT_DOCS: Record<string, boolean> = {
  BUSINESS_PLAN: true,
  FINANCIAL_CAPACITY: true,
  TAX_CLEARANCE: true,
  ID_CARD: true,
  VOEN_CERT: true,
  REGISTRY_EXTRACT: true,
  EXPERIENCE: false
};

function suggestMin(ha: number, purpose: Purpose): string {
  return String(Math.max(10_000, Math.round((ha * MIN_PER_HA[purpose]) / 10_000) * 10_000));
}

/** "YYYY-MM-DDTHH:mm" in the browser's local time (the laptops run on Baku time). */
function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDates() {
  // Opens at the start of the current hour, so an approved competition is open at once.
  const opens = new Date();
  opens.setMinutes(0, 0, 0);
  const deadline = new Date(opens);
  deadline.setDate(deadline.getDate() + 30);
  deadline.setHours(18, 0, 0, 0);
  return { opens: toLocalInput(opens), deadline: toLocalInput(deadline) };
}

type Lot = { min: string };

export function CompetitionForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit
}: {
  initial?: AdminCompetition;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (body: CompetitionInput) => void;
}) {
  const { data: areas, isLoading: areasLoading } = useAdminAreas("AVAILABLE");
  const { data: docTypes } = useDocumentTypes();
  const dates = useMemo(defaultDates, []);
  const [title, setTitle] = useState(initial?.title_az ?? "");
  const [description, setDescription] = useState(initial?.description_az ?? "");
  const [conditions, setConditions] = useState(
    initial?.conditions_az ??
      "Müsabiqədə fiziki və hüquqi şəxslər iştirak edə bilər. Hər sahə üzrə qalib investisiya həcmi, yaradılacaq iş yerləri, təcrübə və biznes planın keyfiyyəti əsasında müəyyən edilir. Yekun qərar müsabiqə komissiyası tərəfindən verilir."
  );
  const [opens, setOpens] = useState(initial ? toLocalInput(initial.opens_at) : dates.opens);
  const [deadline, setDeadline] = useState(initial ? toLocalInput(initial.deadline_at) : dates.deadline);
  const [lots, setLots] = useState<Record<string, Lot>>(() =>
    Object.fromEntries(
      (initial?.lots ?? []).map((l) => [l.farm_area_id, { min: l.min_investment_azn ? String(Math.round(Number(l.min_investment_azn))) : "" }])
    )
  );
  const [docs, setDocs] = useState<Record<string, boolean>>(() =>
    initial ? Object.fromEntries(initial.required_documents.map((d) => [d.code, !!d.mandatory])) : DEFAULT_DOCS
  );
  const [q, setQ] = useState("");
  const [purpose, setPurpose] = useState<Purpose | null>(null);

  // Plots the specialist may offer: cleared of mines and not in another active competition,
  // plus the plots already on this draft.
  const candidates = useMemo(() => {
    const own = new Set(initial?.lots.map((l) => l.farm_area_id));
    return (areas ?? []).filter(
      (a) => own.has(a.id) || (a.demining_status === "CLEARED" && !a.competition_number)
    );
  }, [areas, initial]);

  const visible = candidates.filter((a) => {
    if (purpose && a.purpose !== purpose) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLocaleLowerCase("az");
    return `${a.code} ${a.name_az} ${a.rayon_name}`.toLocaleLowerCase("az").includes(needle);
  });

  const selected = candidates.filter((a) => lots[a.id]);
  const totalHa = selected.reduce((s, a) => s + Number(a.area_ha), 0);

  const toggle = (id: string, ha: number, p: Purpose) =>
    setLots((cur) => {
      const next = { ...cur };
      if (next[id]) delete next[id];
      else next[id] = { min: suggestMin(ha, p) };
      return next;
    });

  const err = error instanceof ApiError ? error : null;
  const fe = (name: string) => err?.forField(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title_az: title,
      description_az: description,
      conditions_az: conditions,
      opens_at: new Date(opens).toISOString(),
      deadline_at: new Date(deadline).toISOString(),
      lots: selected.map((a) => ({ farm_area_id: a.id, min_investment_azn: lots[a.id].min || null })),
      required_documents: Object.entries(docs).map(([code, mandatory]) => ({ code, mandatory }))
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={err && (err.fieldErrors.length === 0 || err.fieldErrors.some((f) => !f.field)) ? (err.fieldErrors.find((f) => !f.field)?.message ?? err.message) : null} />

      <Panel>
        <PanelHeader>
          <PanelTitle>Ümumi məlumat</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <Field id="title_az" label="Müsabiqənin adı" required error={fe("title_az")} className="md:col-span-2">
            <Input id="title_az" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field id="description_az" label="Qısa təsvir" required error={fe("description_az")} className="md:col-span-2">
            <Textarea id="description_az" maxLength={3000} className="min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field id="opens_at" label="Qəbulun başlanması (Bakı vaxtı)" required error={fe("opens_at")}>
            <Input id="opens_at" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} />
          </Field>
          <Field id="deadline_at" label="Son müraciət tarixi (Bakı vaxtı)" required error={fe("deadline_at")}>
            <Input id="deadline_at" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field id="conditions_az" label="Müsabiqənin şərtləri" required error={fe("conditions_az")} className="md:col-span-2">
            <Textarea id="conditions_az" maxLength={5000} value={conditions} onChange={(e) => setConditions(e.target.value)} />
          </Field>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Lotlar</PanelTitle>
          <span className="text-13 text-ink-2 tabular">
            Seçilib: {selected.length} sahə · {formatHectares(totalHa)}
          </span>
        </PanelHeader>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kod, ad və ya rayon" className="pl-8" aria-label="Sahə axtar" />
          </div>
          {PURPOSES.map((p) => (
            <PurposeChip key={p} purpose={p} selected={purpose === p} onToggle={() => setPurpose(purpose === p ? null : p)} />
          ))}
        </div>
        <p className="border-b border-border px-4 py-2 text-13 text-ink-3">
          Yalnız minalardan təmizlənmiş və başqa aktiv müsabiqədə olmayan sahələr göstərilir.
        </p>
        <div className="max-h-[420px] overflow-y-auto">
          {areasLoading ? (
            <Skeleton className="m-4 h-40" />
          ) : (
            <table className="condensed w-full text-13">
              <thead className="sticky top-0 bg-surface-2">
                <tr className="text-left text-ink-2">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Sahə</th>
                  <th className="px-3 py-2 font-medium">Rayon</th>
                  <th className="px-3 py-2 font-medium">Təyinat</th>
                  <th className="px-3 py-2 text-right font-medium">Ölçü</th>
                  <th className="px-3 py-2 text-right font-medium">Min. investisiya, AZN</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {visible.map((a) => {
                  const on = !!lots[a.id];
                  return (
                    <tr key={a.id} className={cn("border-t border-border", on && "bg-primary-50/60")}>
                      <td className="px-3 py-1.5">
                        <Checkbox checked={on} onCheckedChange={() => toggle(a.id, Number(a.area_ha), a.purpose)} aria-label={`${a.code} seç`} />
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="font-mono font-medium">{a.code}</span>
                        <span className="block max-w-[260px] truncate text-2xs text-ink-3">{a.name_az}</span>
                      </td>
                      <td className="px-3 py-1.5 text-ink-2">{a.rayon_name}</td>
                      <td className="px-3 py-1.5"><PurposeChip purpose={a.purpose} /></td>
                      <td className="px-3 py-1.5 text-right">{formatHectares(Number(a.area_ha))}</td>
                      <td className="px-3 py-1.5 text-right">
                        {on ? (
                          <Input
                            inputMode="numeric"
                            aria-label={`${a.code} minimum investisiya`}
                            className="ml-auto h-8 w-32 text-right tabular"
                            value={lots[a.id].min}
                            onChange={(e) => setLots((cur) => ({ ...cur, [a.id]: { min: e.target.value.replace(/\D/g, "") } }))}
                          />
                        ) : (
                          <span className="text-ink-3">{formatNumber(Number(suggestMin(Number(a.area_ha), a.purpose)))}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-ink-2">Uyğun sahə tapılmadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        {fe("lots") && <p className="px-4 py-2 text-13 text-danger">{fe("lots")}</p>}
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Tələb olunan sənədlər</PanelTitle>
        </PanelHeader>
        <ul className="divide-y divide-border">
          {docTypes?.map((d) => {
            const on = d.code in docs;
            return (
              <li key={d.code} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <label className="flex items-start gap-2.5">
                  <Checkbox
                    className="mt-0.5"
                    checked={on}
                    onCheckedChange={(v) =>
                      setDocs((cur) => {
                        const next = { ...cur };
                        if (v) next[d.code] = true;
                        else delete next[d.code];
                        return next;
                      })
                    }
                  />
                  <span>
                    {d.name_az}
                    {d.applies_to !== "ANY" && (
                      <span className="block text-13 text-ink-3">
                        {d.applies_to === "COMPANY" ? "Yalnız hüquqi şəxslər" : "Yalnız fiziki şəxslər"}
                      </span>
                    )}
                  </span>
                </label>
                {on && (
                  <div className="flex rounded-2xl border border-border text-13" role="radiogroup" aria-label={`${d.name_az}: məcburilik`}>
                    {[true, false].map((m) => (
                      <button
                        key={String(m)}
                        type="button"
                        role="radio"
                        aria-checked={docs[d.code] === m}
                        onClick={() => setDocs((cur) => ({ ...cur, [d.code]: m }))}
                        className={cn("px-2.5 py-1", docs[d.code] === m ? "bg-primary text-primary-fg" : "text-ink-2 hover:bg-surface-2")}
                      >
                        {m ? "Məcburi" : "Könüllü"}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending || selected.length === 0}>
          {pending ? "Yadda saxlanılır…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
