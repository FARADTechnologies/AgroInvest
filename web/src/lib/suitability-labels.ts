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

export type SuitabilityNames = {
  group: (key: string, az: string) => string;
  factor: (key: string, az: string) => string;
  activity: (key: string, az: string) => string;
  unit: (az: string) => string;
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
    unit: (az: string) => (en ? UNIT_EN[az] ?? az : az)
  };
}
