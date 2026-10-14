"use client";

import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useState } from "react";

// Online: a label-free basemap. We strip its boundary layers too, so the only
// borders and names on the map are our own curated layers.
const ONLINE_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";

const PAPER = "#F1EEE8";
export const WATER = "#D5E0E4";

/** Offline fallback: a plain paper background; our own layers carry the geography. */
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": PAPER } }]
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

/**
 * Picks the basemap once per page load: the online style when it answers
 * within 2.5 s, otherwise the offline style, so venue Wi-Fi never blanks the map.
 */
export function useBasemap(): { style: StyleSpecification | null; online: boolean } {
  const [state, setState] = useState<{ style: StyleSpecification | null; online: boolean }>({
    style: null,
    online: false
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    fetch(ONLINE_STYLE_URL, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((style: StyleSpecification) => !cancelled && setState({ style: adapt(style), online: true }))
      .catch(() => !cancelled && setState({ style: OFFLINE_STYLE, online: false }))
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return state;
}
