"use client";

import { FileUp, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";

import { AREA_STATUS_LABEL } from "@/components/domain/area-status";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { type AreaFeatureCollection, useMapContext } from "@/features/areas/api";
import { selectClass } from "@/features/areas/filter-panel";
import { IRRIGATION_LABEL } from "@/features/areas/selected-area-card";
import { ApiError } from "@/lib/api/client";
import { PURPOSES, type Purpose } from "@/lib/domain";

import type { AdminAreaDetail, AreaInput } from "./api";

const FarmMap = dynamic(() => import("@/components/map/farm-map").then((m) => m.FarmMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#F1EEE8]" />
});

type Geometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** Accepts a geometry, a Feature or a FeatureCollection (first feature) and returns the polygon. */
export function parsePolygon(text: string): { geometry?: Geometry; error?: string } {
  if (!text.trim()) return {};
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "JSON oxunmadı" };
  }
  let g = data as { type?: string; geometry?: unknown; features?: { geometry?: unknown }[] };
  if (g.type === "FeatureCollection") g = (g.features?.[0]?.geometry ?? {}) as typeof g;
  else if (g.type === "Feature") g = (g.geometry ?? {}) as typeof g;
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return { error: "Həndəsə Polygon və ya MultiPolygon olmalıdır" };
  return { geometry: g as unknown as Geometry };
}

function previewOf(geometry: Geometry, purpose: Purpose): AreaFeatureCollection {
  const multi: GeoJSON.MultiPolygon =
    geometry.type === "Polygon" ? { type: "MultiPolygon", coordinates: [geometry.coordinates] } : geometry;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: multi,
        properties: {
          id: "preview",
          code: "preview",
          purpose,
          area_ha: 0,
          rayon: "",
          village: null,
          open: true,
          deadline_at: null,
          fao_class: null,
          demining: "CLEARED"
        }
      }
    ]
  };
}

export function AreaForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit
}: {
  initial?: AdminAreaDetail;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (body: AreaInput) => void;
}) {
  const { data: context } = useMapContext();
  const file = useRef<HTMLInputElement>(null);
  const locked = initial ? !initial.editable_geometry : false;
  const [geoText, setGeoText] = useState(initial ? JSON.stringify(initial.geometry) : "");
  const [purpose, setPurpose] = useState<Purpose>(initial?.purpose ?? "CROP");
  const [form, setForm] = useState({
    name_az: initial?.name_az ?? "",
    conditions_of_use: initial?.conditions_of_use ?? "",
    lease_term_years: String(initial?.lease_term_years ?? 25),
    annual_fee_azn_per_ha: initial?.annual_fee_azn_per_ha ? String(Number(initial.annual_fee_azn_per_ha)) : "",
    irrigation: initial?.irrigation ?? "NONE",
    soil_type: initial?.soil_type ?? "",
    demining_status: initial?.demining_status ?? "NOT_SURVEYED",
    demining_certified_on: initial?.demining_certified_on ?? "",
    status: initial?.status ?? "AVAILABLE"
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const parsed = useMemo(() => parsePolygon(geoText), [geoText]);
  const preview = useMemo(() => (parsed.geometry ? previewOf(parsed.geometry, purpose) : undefined), [parsed, purpose]);
  const err = error instanceof ApiError ? error : null;
  const fe = (k: string) => err?.forField(k);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setGeoText("");
    setGeoText(await f.text());
    if (file.current) file.current.value = "";
  };

  const geometryChanged = !initial || geoText !== JSON.stringify(initial.geometry);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: AreaInput = {
      name_az: form.name_az.trim() || null,
      conditions_of_use: form.conditions_of_use.trim() || null,
      lease_term_years: form.lease_term_years ? Number(form.lease_term_years) : null,
      annual_fee_azn_per_ha: form.annual_fee_azn_per_ha ? form.annual_fee_azn_per_ha.replace(",", ".") : null,
      irrigation: form.irrigation as AreaInput["irrigation"],
      soil_type: form.soil_type.trim() || null,
      demining_status: form.demining_status as AreaInput["demining_status"],
      demining_certified_on: form.demining_certified_on || null
    };
    if (!locked) {
      body.purpose = purpose;
      if (geometryChanged) body.geometry = parsed.geometry as unknown as Record<string, unknown>;
    }
    if (initial && !locked) body.status = form.status as AreaInput["status"];
    if (!initial) body.status = form.status as AreaInput["status"];
    onSubmit(body);
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={err && err.fieldErrors.length === 0 ? err.message : null} />

      <Panel>
        <PanelHeader>
          <PanelTitle>Poliqon</PanelTitle>
          {locked && (
            <span className="inline-flex items-center gap-1 text-13 text-ink-3">
              <Lock className="size-3.5" aria-hidden /> Sahə müsabiqədədir: həndəsə və təyinat dəyişdirilə bilməz
            </span>
          )}
        </PanelHeader>
        <PanelBody className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Field
              id="geometry"
              label="GeoJSON (WGS84)"
              required={!initial}
              hint="Polygon, MultiPolygon, Feature və ya FeatureCollection. QGIS və ya geojson.io-dan ixrac edilə bilər."
              error={parsed.error ?? fe("geometry")}
            >
              <Textarea
                id="geometry"
                className="min-h-48 font-mono text-13"
                value={geoText}
                disabled={locked}
                onChange={(e) => setGeoText(e.target.value)}
                placeholder='{"type": "Polygon", "coordinates": [[[46.9, 39.9], ...]]}'
              />
            </Field>
            <input ref={file} type="file" accept=".geojson,.json,application/geo+json,application/json" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            <Button type="button" variant="secondary" size="sm" disabled={locked} onClick={() => file.current?.click()}>
              <FileUp /> Fayldan yüklə (.geojson)
            </Button>
          </div>
          <div className="h-72 overflow-hidden rounded-2xl border border-border">
            {preview ? (
              <FarmMap key={geoText.length} features={preview} context={context} compact className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center bg-surface-2 px-6 text-center text-13 text-ink-3">
                Poliqon daxil edildikdə burada görünəcək. Ölçü, rayon və ən yaxın kənd yadda saxlanılarkən serverdə hesablanır.
              </div>
            )}
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Sahənin məlumatları</PanelTitle>
        </PanelHeader>
        <PanelBody className="grid gap-4 md:grid-cols-2">
          <fieldset className="md:col-span-2" disabled={locked}>
            <legend className="mb-1.5 text-13 font-medium text-ink-2">Təyinat</legend>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <PurposeChip key={p} purpose={p} selected={purpose === p} onToggle={() => !locked && setPurpose(p)} />
              ))}
            </div>
          </fieldset>
          <Field id="name_az" label="Ad" hint="Boş qalsa kəndin adı və təyinatdan yaradılır" className="md:col-span-2">
            <Input id="name_az" maxLength={200} value={form.name_az} onChange={set("name_az")} />
          </Field>
          <Field id="conditions_of_use" label="İstifadə şərtləri" className="md:col-span-2" error={fe("conditions_of_use")}>
            <Textarea id="conditions_of_use" maxLength={5000} value={form.conditions_of_use} onChange={set("conditions_of_use")} />
          </Field>
          <Field id="lease_term_years" label="İcarə müddəti (il)" error={fe("lease_term_years")}>
            <Input id="lease_term_years" inputMode="numeric" className="tabular" value={form.lease_term_years} onChange={set("lease_term_years")} />
          </Field>
          <Field id="annual_fee" label="İllik icarə haqqı (AZN/ha)" error={fe("annual_fee_azn_per_ha")}>
            <Input id="annual_fee" inputMode="decimal" className="tabular" value={form.annual_fee_azn_per_ha} onChange={set("annual_fee_azn_per_ha")} />
          </Field>
          <Field id="irrigation" label="Suvarma">
            <select id="irrigation" className={selectClass} value={form.irrigation} onChange={set("irrigation")}>
              {Object.entries(IRRIGATION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field id="soil_type" label="Torpaq">
            <Input id="soil_type" maxLength={120} value={form.soil_type} onChange={set("soil_type")} placeholder="Məsələn: Boz-qəhvəyi torpaq" />
          </Field>
          <Field id="demining_status" label="Minatəmizləmə" hint="Minalardan təmizlənməmiş sahə müsabiqəyə çıxarıla bilməz">
            <select id="demining_status" className={selectClass} value={form.demining_status} onChange={set("demining_status")}>
              <option value="CLEARED">Minalardan təmizlənib</option>
              <option value="IN_PROGRESS">Minatəmizləmə davam edir</option>
              <option value="NOT_SURVEYED">Tədqiq edilməyib</option>
            </select>
          </Field>
          <Field id="demining_certified_on" label="Sertifikat tarixi">
            <Input id="demining_certified_on" type="date" value={form.demining_certified_on} onChange={set("demining_certified_on")} />
          </Field>
          <Field id="status" label="Status">
            <select id="status" className={selectClass} value={form.status} disabled={locked} onChange={set("status")}>
              <option value="AVAILABLE">Müsabiqəyə hazırdır</option>
              <option value="DRAFT">Qaralama (portalda görünmür)</option>
              {initial && <option value="WITHDRAWN">Geri çəkilib</option>}
              {locked && initial && <option value={initial.status}>{AREA_STATUS_LABEL[initial.status]}</option>}
            </select>
          </Field>
        </PanelBody>
      </Panel>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending || (!initial && !parsed.geometry)}>
          {pending ? "Yadda saxlanılır…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
