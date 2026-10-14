"use client";

import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useState } from "react";

// Online: a label-free basemap. We strip its boundary layers too, so the only
// borders and names on the map are our own curated layers.
const ONLINE_STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json";

const PAPER = "#F1EEE8";
export const WATER = "#D5E0E4";

export type BasemapKind = "map" | "satellite";

/** Offline fallback: a plain paper background; our own layers carry the geography. */
export const OFFLINE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": PAPER } }]
};

// Imagery only, no place labels (the place-name policy applies to every basemap).
// EOxCloudless is Sentinel-2 at 10 m, licensed CC BY-NC-SA 4.0: fine for a
// non-commercial prototype; a pilot needs a commercial or national imagery licence.
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg"],
      tileSize: 256,
      maxzoom: 14,
      attribution:
        '<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless 2025</a> by EOX IT Services GmbH ' +
        "(contains modified Copernicus Sentinel data 2025), " +
        '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>'
    }
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#2E3A30" } },
    { id: "satellite", type: "raster", source: "satellite" }
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

// One probe per page load, shared by every map and by the basemap switch.
let probe: Promise<StyleSpecification | null> | null = null;

function probeOnline(): Promise<StyleSpecification | null> {
  if (!probe) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    probe = fetch(ONLINE_STYLE_URL, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((style: StyleSpecification) => adapt(style))
      .catch(() => {
        probe = null; // try again on the next map that mounts
        return null;
      })
      .finally(() => clearTimeout(timer));
  }
  return probe;
}

/** Whether online basemaps can be used: the probe answered and the browser reports a connection. */
function useOnlineStyle(): { vector: StyleSpecification | null; ready: boolean; online: boolean } {
  const [vector, setVector] = useState<StyleSpecification | null>(null);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;
    probeOnline().then((style) => {
      if (cancelled) return;
      setVector(style);
      setReady(true);
    });
    const sync = () => setConnected(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return { vector, ready, online: !!vector && connected };
}

/**
 * Picks the basemap: the online vector style when it answers within 2.5 s,
 * otherwise the offline style, so venue Wi-Fi never blanks the map. Satellite
 * imagery is only used while online; offline it falls back to the plain map.
 */
export function useBasemap(kind: BasemapKind = "map"): { style: StyleSpecification | null; online: boolean } {
  const { vector, ready, online } = useOnlineStyle();
  if (!ready) return { style: null, online: false };
  if (kind === "satellite" && online) return { style: SATELLITE_STYLE, online };
  return { style: vector ?? OFFLINE_STYLE, online };
}

/** For controls outside the map: true once online basemaps are known to work. */
export function useOnlineBasemaps(): boolean {
  return useOnlineStyle().online;
}
