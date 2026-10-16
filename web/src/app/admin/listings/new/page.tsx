"use client";

import { Eraser, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useAreaFeatures, useMapContext } from "@/features/areas/api";
import { selectClass } from "@/features/areas/filter-panel";
import type { AreaFilters } from "@/features/areas/filters";
import { IRRIGATION_LABEL } from "@/features/areas/selected-area-card";
import { useCreateListing } from "@/features/listings/api";
import { ApiError } from "@/lib/api/client";
import { PURPOSES, type Purpose } from "@/lib/domain";
import { useL, useT } from "@/lib/i18n";
import { formatHectares } from "@/lib/utils";

import { ringHectares } from "@/components/map/draw-map";

const DrawMap = dynamic(() => import("@/components/map/draw-map").then((m) => m.DrawMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#F1EEE8]" />
});

type Point = [number, number];

// Every plot already on the portal, so the new one is drawn beside them.
const ALL: AreaFilters = {
  purposes: [], region: "", rayonId: null, minHa: null, maxHa: null, openOnly: false, q: "",
  sort: "deadline", feeMin: null, feeMax: null, invMin: null, invMax: null
};

function inDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function NewListingPage() {
  const t = useT();
  const L = useL();
  const router = useRouter();
  const { data: context } = useMapContext();
  const { data: existing } = useAreaFeatures(ALL);
  const create = useCreateListing();
  const [points, setPoints] = useState<Point[]>([]);
  const [satellite, setSatellite] = useState(false);
  const [form, setForm] = useState({
    purpose: "CROP" as Purpose,
    title_az: "",
    description_az: "",
    conditions_az: "",
    lease_term_years: "25",
    annual_fee_azn_per_ha: "30",
    min_investment_azn: "",
    irrigation: "NONE",
    deadline: inDays(30),
    demining_certified_on: ""
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const hectares = useMemo(() => ringHectares(points), [points]);

  const err = create.error instanceof ApiError ? create.error : null;
  const fe = (k: string) => err?.forField(k);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
        purpose: form.purpose,
        title_az: form.title_az.trim(),
        description_az: form.description_az.trim(),
        conditions_az: form.conditions_az.trim() || null,
        lease_term_years: Number(form.lease_term_years),
        annual_fee_azn_per_ha: form.annual_fee_azn_per_ha,
        min_investment_azn: form.min_investment_azn || "0",
        irrigation: form.irrigation as "NONE" | "CANAL" | "WELL" | "RIVER",
        deadline_at: new Date(`${form.deadline}T23:59:00+04:00`).toISOString(),
        demining_certified_on: form.demining_certified_on
      },
      {
        onSuccess: (l) => {
          toast.success(`${L("Elan dərc olundu", "Listing published")}: ${l.area_code}`);
          router.push("/admin/listings");
        }
      }
    );
  };

  const ready = points.length >= 3 && form.title_az.trim().length >= 5 && form.description_az.trim().length >= 10 && !!form.demining_certified_on;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <div className="text-13 text-ink-3">
          <Link href="/admin/listings" className="hover:text-ink">
            {L("Elanlar", "Listings")}
          </Link>{" "}
          / {L("Yeni elan", "New listing")}
        </div>
        <h1 className="mt-1 text-2xl">{L("Yeni elan", "New listing")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {L(
            "Sahəni xəritədə künc nöqtələrinə klikləyərək qeyd edin, şərtləri yazın. Elan dərc olunduqdan sonra kataloqda və xəritədə görünür, uyğunluq balı avtomatik hesablanır və istifadəçilər müraciət edə bilir.",
            "Click the corners of the plot on the map and write the terms. Once published the listing appears in the catalogue and on the map, its suitability is scored automatically and users can apply."
          )}
        </p>
      </div>
      <FormError message={err && err.fieldErrors.length === 0 ? err.message : null} />

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("Sahənin sərhədləri", "Plot boundary")}</PanelTitle>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setSatellite((s) => !s)}>
              {satellite ? L("Xəritə", "Map") : L("Peyk", "Satellite")}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!points.length} onClick={() => setPoints((p) => p.slice(0, -1))}>
              <Undo2 aria-hidden /> {L("Geri", "Undo")}
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!points.length} onClick={() => setPoints([])}>
              <Eraser aria-hidden /> {L("Təmizlə", "Clear")}
            </Button>
          </div>
        </PanelHeader>
        <DrawMap
          context={context}
          existing={existing}
          points={points}
          onChange={setPoints}
          basemap={satellite ? "satellite" : "map"}
          className="h-[420px] w-full"
        />
        <PanelBody className="flex flex-wrap items-center justify-between gap-2 py-3 text-13">
          <span className="text-ink-2">
            {points.length < 3
              ? L(
                  `Ən azı 3 nöqtə qeyd edin (${points.length}/3). Boz sahələr artıq portaldadır.`,
                  `Mark at least 3 points (${points.length}/3). Grey plots are already on the portal.`
                )
              : `${points.length} ${L("nöqtə", "points")} · ${L("təxminən", "about")} ${formatHectares(hectares)}`}
          </span>
          {fe("geometry") && <span className="text-danger">{fe("geometry")}</span>}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("Elanın şərtləri", "Listing terms")}</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 sm:grid-cols-2">
          <Field id="title_az" label={L("Başlıq", "Title")} required error={fe("title_az")} className="sm:col-span-2">
            <Input id="title_az" maxLength={200} placeholder={L("məs. Ağdam, suvarılan əkin sahəsi", "e.g. Ağdam, irrigated cropland")} value={form.title_az} onChange={set("title_az")} />
          </Field>
          <Field id="purpose" label={L("Təyinat", "Purpose")} required>
            <select id="purpose" className={selectClass} value={form.purpose} onChange={set("purpose")}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {t.purpose[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="irrigation" label={L("Suvarma", "Irrigation")}>
            <select id="irrigation" className={selectClass} value={form.irrigation} onChange={set("irrigation")}>
              {Object.entries(IRRIGATION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field id="description_az" label={L("Təsvir", "Description")} required error={fe("description_az")} className="sm:col-span-2">
            <Textarea id="description_az" maxLength={3000} rows={3} value={form.description_az} onChange={set("description_az")} />
          </Field>
          <Field id="conditions_az" label={L("İstifadə şərtləri", "Terms of use")} hint={L("Boş qalsa standart mətn yazılır", "Left empty, a standard text is used")} className="sm:col-span-2">
            <Textarea id="conditions_az" maxLength={5000} rows={3} value={form.conditions_az} onChange={set("conditions_az")} />
          </Field>
          <Field id="lease_term_years" label={L("İcarə müddəti (il)", "Lease term (years)")} required error={fe("lease_term_years")}>
            <Input id="lease_term_years" inputMode="numeric" value={form.lease_term_years} onChange={set("lease_term_years")} />
          </Field>
          <Field id="annual_fee_azn_per_ha" label={L("İllik icarə haqqı (AZN/ha)", "Annual lease fee (AZN/ha)")} required error={fe("annual_fee_azn_per_ha")}>
            <Input id="annual_fee_azn_per_ha" inputMode="decimal" value={form.annual_fee_azn_per_ha} onChange={set("annual_fee_azn_per_ha")} />
          </Field>
          <Field id="min_investment_azn" label={L("Minimum investisiya (AZN)", "Minimum investment (AZN)")} error={fe("min_investment_azn")}>
            <Input id="min_investment_azn" inputMode="numeric" placeholder={L("məs. 250000", "e.g. 250000")} value={form.min_investment_azn} onChange={set("min_investment_azn")} />
          </Field>
          <Field id="deadline" label={L("Son müraciət tarixi", "Application deadline")} required error={fe("deadline_at")}>
            <Input id="deadline" type="date" min={inDays(1)} value={form.deadline} onChange={set("deadline")} />
          </Field>
          <Field
            id="demining_certified_on"
            label={L("ANAMA minatəmizləmə sertifikatının tarixi", "Date of the ANAMA demining certificate")}
            required
            hint={L("Minalardan təmizlənməmiş sahə elan edilə bilməz", "A plot not cleared of mines cannot be listed")}
            error={fe("demining_certified_on")}
            className="sm:col-span-2"
          >
            <Input id="demining_certified_on" type="date" max={inDays(0)} value={form.demining_certified_on} onChange={set("demining_certified_on")} />
          </Field>
        </PanelBody>
      </Panel>

      <div className="flex items-center justify-end gap-3">
        <Button asChild variant="secondary">
          <Link href="/admin/listings">{L("Ləğv et", "Cancel")}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={!ready || create.isPending}>
          {create.isPending ? L("Dərc olunur…", "Publishing…") : L("Elanı dərc et", "Publish listing")}
        </Button>
      </div>
    </form>
  );
}
