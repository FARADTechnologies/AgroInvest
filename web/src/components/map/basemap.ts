"use client";

import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useState } from "react";

import { SATELLITE_TILES } from "@/lib/imagery";

export type Basemap = "map" | "satellite";

// Online: a label-free basemap. We strip its boundary layers too, so the only
// borders and names on the map are our own curated layers.
const ONLINE_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";

export const PAPER = "#EEF1E9";
const WATER = "#CFE0E3";

/** Offline fallback: a plain paper background; our own layers carry the geography. */
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": PAPER } }]
};

/** Satellite imagery without labels; names come from our own rayon layer. */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: { type: "raster", tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 18 }
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#1B2A1F" } },
    { id: "imagery", type: "raster", source: "imagery", paint: { "raster-saturation": 0.08, "raster-contrast": 0.06 } }
  ]
};

function adapt(style: StyleSpecification): StyleSpecification {
  const layers = style.layers
    .filter((l) => !l.id.includes("boundary") && l.type !== "symbol")
    .map((l) => {
      if (l.id === "background" && l.type === "background") {
        return { ...l, paint: { ...l.paint, "background-color": PAPER } };
      }
      if (l.id.startsWith("water") && l.type === "fill") {
        return { ...l, paint: { ...l.paint, "fill-color": WATER } };
      }
      return l;
    });
  return { ...style, layers } as StyleSpecification;
}

// The probe runs once per page load and is shared by every map on the page.
let probe: Promise<{ style: StyleSpecification; online: boolean }> | null = null;

function probeOnline() {
  if (!probe) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    probe = fetch(ONLINE_STYLE_URL, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((style: StyleSpecification) => ({ style: adapt(style), online: true }))
      .catch(() => ({ style: OFFLINE_STYLE, online: false }))
      .finally(() => clearTimeout(timer));
  }
  return probe;
}

/**
 * Picks the basemap once per page load: the online style when it answers
 * within 2.5 s, otherwise the offline style, so venue Wi-Fi never blanks the map.
 * Satellite imagery is only offered when the network is reachable.
 */
export function useBasemap(kind: Basemap = "map"): { style: StyleSpecification | null; online: boolean } {
  const [state, setState] = useState<{ style: StyleSpecification | null; online: boolean }>({ style: null, online: false });

  useEffect(() => {
    let cancelled = false;
    probeOnline().then((s) => !cancelled && setState(s));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state.style) return state;
  return { style: kind === "satellite" && state.online ? SATELLITE_STYLE : state.style, online: state.online };
}
