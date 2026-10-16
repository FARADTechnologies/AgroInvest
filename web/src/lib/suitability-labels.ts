"use client";

import { useCallback } from "react";

import { useLang } from "@/lib/i18n";

/**
 * English names of the suitability groups, factors and activities. The API sends the
 * Azerbaijani names with every result; in English the interface swaps them by key.
 */
const GROUP_EN: Record<string, string> = {
  SOIL: "Soil",
  CLIMATE: "Climate",
  TERRAIN: "Terrain",
  ACCESS: "Water and infrastructure"
};

const FACTOR_EN: Record<string, string> = {
  fertility: "Fertility index",
  soc: "Organic carbon",
  nitrogen: "Total nitrogen",
  ph: "Soil pH",
  texture: "Texture",
  salinity: "Salinity (EC)",
  landcover: "Land cover",
  precip: "Annual precipitation",
  temp: "Mean annual temperature",
  frost_free: "Frost-free days",
  ghi: "Solar radiation (GHI)",
  elevation: "Elevation",
  slope: "Slope",
  aspect: "Aspect",
  water: "Distance to water",
  road: "Distance to a main road",
  settlement: "Distance to a settlement",
  potable: "Distance to drinking water"
};

const ACTIVITY_EN: Record<string, string> = {
  CROP: "Crop farming",
  ORCHARD: "Orchards",
  LIVESTOCK: "Livestock",
  OTHER: "Other (greenhouses, processing)"
};

const UNIT_EN: Record<string, string> = { gün: "days", "kWh/m²/il": "kWh/m²/yr" };

/** Texts the API writes in place of a number: textures, land cover, aspect, on-site water. */
const TEXT_EN: Record<string, string> = {
  Gilli: "Clay",
  "Ağır gillicəli": "Clay loam",
  "Orta gillicəli": "Loam",
  "Yüngül gillicəli": "Sandy loam",
  "Çınqıllı (skeletli)": "Stony (skeletal)",
  "Əkin sahəsi (OSM)": "Cropland (OSM)",
  "Bağ və ya üzümlük (OSM)": "Orchard or vineyard (OSM)",
  "Çəmənlik (OSM)": "Meadow (OSM)",
  "Kənd təsərrüfatı sahəsi (OSM)": "Farmland (OSM)",
  "Məlum deyil (OSM-də xəritələnməyib)": "Unknown (not mapped in OSM)",
  "Düz sahə (istiqamət yoxdur)": "Flat (no aspect)",
  "Sahədə çıxış var (≤ 0,3 km)": "Available on site (≤ 0.3 km)",
  "Minatəmizləmə başa çatmayıb (nümayiş statusu)": "Demining is not finished (demo status)"
};

const COMPASS_EN: Record<string, string> = {
  Şimal: "North",
  "Şimal-şərq": "North-east",
  Şərq: "East",
  "Cənub-şərq": "South-east",
  Cənub: "South",
  "Cənub-qərb": "South-west",
  Qərb: "West",
  "Şimal-qərb": "North-west"
};

/** Where each demo factor will come from once real data is loaded, where the name differs. */
const PLANNED_EN: Record<string, string> = {
  texture: "SoilGrids 2.0 (clay, silt, sand)",
  landcover: "OpenStreetMap / EKTIS",
  potable: "OSM (drinking_water, spring, water_well) / Azersu network"
};

function textEn(az: string): string {
  if (TEXT_EN[az]) return TEXT_EN[az];
  const aspect = /^(\d+)° · (.+)$/.exec(az);
  if (aspect) return `${aspect[1]}° · ${COMPASS_EN[aspect[2]] ?? aspect[2]}`;
  const salt = /^Ağır şoranlaşma: EC (.+) dS\/m > (.+) \(bağ üçün yararsız\)$/.exec(az);
  if (salt) return `Severe salinity: EC ${salt[1]} dS/m > ${salt[2]} (unfit for orchards)`;
  return az;
}

export type SuitabilityNames = {
  group: (key: string, az: string) => string;
  factor: (key: string, az: string) => string;
  activity: (key: string, az: string) => string;
  unit: (az: string) => string;
  /** A factor's text value or a constraint reason. */
  text: (az: string) => string;
  planned: (key: string, az: string) => string;
};

export function useSuitabilityNames(): SuitabilityNames {
  const { lang } = useLang();
  const en = lang === "en";
  const pick = useCallback(
    (table: Record<string, string>) => (key: string, az: string) => (en ? table[key] ?? az : az),
    [en]
  );
  return {
    group: pick(GROUP_EN),
    factor: pick(FACTOR_EN),
    activity: pick(ACTIVITY_EN),
    unit: (az: string) => (en ? UNIT_EN[az] ?? az : az),
    text: (az: string) => (en ? textEn(az) : az),
    planned: pick(PLANNED_EN)
  };
}
