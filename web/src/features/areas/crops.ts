import {
  Apple,
  Beef,
  Cherry,
  Clover,
  Factory,
  Grape,
  MountainSnow,
  Sprout,
  Warehouse,
  Wheat
} from "lucide-react";

import type { Purpose } from "@/lib/domain";

// Recommended use inside each purpose (Əkinçilik → taxıl, arpa, yonca …).
// The API has no crop field, so this is a transparent rule over data every plot
// already carries: irrigation, size and region. It is decision support shown
// as "tövsiyə", never a binding designation.

export type CropKey =
  | "WHEAT"
  | "BARLEY"
  | "ALFALFA"
  | "FRUIT"
  | "POMEGRANATE"
  | "VINEYARD"
  | "SUMMER_PASTURE"
  | "WINTER_PASTURE"
  | "HAYFIELD"
  | "GREENHOUSE"
  | "PROCESSING";

type CropMeta = { az: string; en: string; whyAz: string; whyEn: string; icon: typeof Wheat; color: string };

export const CROP_META: Record<CropKey, CropMeta> = {
  WHEAT: {
    az: "Taxıl (buğda)",
    en: "Grain (wheat)",
    whyAz: "Suvarılan, 40 ha-dan böyük sahə: mexanikləşdirilmiş taxılçılıq üçün",
    whyEn: "Irrigated, over 40 ha: suited to mechanised grain",
    icon: Wheat,
    color: "#E2B234"
  },
  BARLEY: {
    az: "Arpa",
    en: "Barley",
    whyAz: "Suvarma yoxdur: quraqlığa davamlı dəmyə əkini",
    whyEn: "No irrigation: drought-tolerant rain-fed crop",
    icon: Sprout,
    color: "#C9A227"
  },
  ALFALFA: {
    az: "Yonca",
    en: "Alfalfa",
    whyAz: "Suvarılan, kiçik sahə: yem bitkisi və torpağın bərpası",
    whyEn: "Irrigated, smaller plot: fodder crop that restores soil",
    icon: Clover,
    color: "#7FB548"
  },
  FRUIT: {
    az: "Meyvə bağı",
    en: "Fruit orchard",
    whyAz: "Kanal və ya çay suvarması: alma, armud, gilas",
    whyEn: "Canal or river water: apples, pears, cherries",
    icon: Apple,
    color: "#60AA46"
  },
  POMEGRANATE: {
    az: "Nar bağı",
    en: "Pomegranate",
    whyAz: "Subartezian quyusu: damcı suvarma ilə nar",
    whyEn: "Artesian well: drip-irrigated pomegranate",
    icon: Cherry,
    color: "#C2453B"
  },
  VINEYARD: {
    az: "Üzümlük",
    en: "Vineyard",
    whyAz: "Suvarma yoxdur: üzüm az su tələb edir",
    whyEn: "No irrigation: vines need little water",
    icon: Grape,
    color: "#7A4C9A"
  },
  SUMMER_PASTURE: {
    az: "Yaylaq (yay otlağı)",
    en: "Summer pasture",
    whyAz: "Dağlıq bölgə: yay aylarında otlaq",
    whyEn: "Highlands: grazing in the summer months",
    icon: MountainSnow,
    color: "#8A6A4B"
  },
  WINTER_PASTURE: {
    az: "Qışlaq",
    en: "Winter pasture",
    whyAz: "Düzənlik: qış otlağı və tövlə təsərrüfatı",
    whyEn: "Lowland: winter grazing and barns",
    icon: Beef,
    color: "#B06840"
  },
  HAYFIELD: {
    az: "Biçənək",
    en: "Hayfield",
    whyAz: "Suvarılan otlaq: ot tədarükü",
    whyEn: "Irrigated grassland: hay production",
    icon: Sprout,
    color: "#9CB04A"
  },
  GREENHOUSE: {
    az: "İstixana",
    en: "Greenhouse",
    whyAz: "Su mənbəyi var: il boyu tərəvəz",
    whyEn: "Water on site: year-round vegetables",
    icon: Warehouse,
    color: "#6484A8"
  },
  PROCESSING: {
    az: "Emal müəssisəsi",
    en: "Processing",
    whyAz: "Suvarma yoxdur: ilkin emal və anbar",
    whyEn: "No irrigation: primary processing and storage",
    icon: Factory,
    color: "#5A6B7E"
  }
};

/** Crop types per purpose, in display order. */
export const CROPS_BY_PURPOSE: Record<Purpose, CropKey[]> = {
  CROP: ["WHEAT", "BARLEY", "ALFALFA"],
  ORCHARD: ["FRUIT", "POMEGRANATE", "VINEYARD"],
  LIVESTOCK: ["SUMMER_PASTURE", "WINTER_PASTURE", "HAYFIELD"],
  OTHER: ["GREENHOUSE", "PROCESSING"]
};

const HIGHLAND_RAYONS = new Set(["Şuşa", "Kəlbəcər", "Laçın"]);

type CropInput = {
  purpose: Purpose;
  irrigation: string;
  area_ha: string | number;
  region_code?: string;
  rayon_name: string;
};

export function cropOf(a: CropInput): CropKey {
  const irrigated = a.irrigation !== "NONE";
  switch (a.purpose) {
    case "CROP":
      if (!irrigated) return "BARLEY";
      return Number(a.area_ha) >= 40 ? "WHEAT" : "ALFALFA";
    case "ORCHARD":
      if (!irrigated) return "VINEYARD";
      return a.irrigation === "WELL" ? "POMEGRANATE" : "FRUIT";
    case "LIVESTOCK":
      if (a.region_code === "EAST_ZANGEZUR" || HIGHLAND_RAYONS.has(a.rayon_name)) return "SUMMER_PASTURE";
      return irrigated ? "HAYFIELD" : "WINTER_PASTURE";
    default:
      return irrigated ? "GREENHOUSE" : "PROCESSING";
  }
}
