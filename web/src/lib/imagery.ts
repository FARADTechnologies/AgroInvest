// Satellite imagery of the region, used as decorative backgrounds (landing hero,
// sign-in) and as the map's satellite layer. Esri World Imagery needs no key;
// every place that shows it credits the provider. When the network is down the
// images simply fail to load and the green gradient beneath them shows instead.

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";

export const SATELLITE_TILES = `${ESRI}/tile/{z}/{y}/{x}`;
export const SATELLITE_ATTRIBUTION = "Peyk: Esri, Maxar, Earthstar Geographics";

/** A single satellite still for a lon/lat bounding box. */
export function satelliteStill(bbox: [number, number, number, number], width = 1600, height = 1000): string {
  const params = new URLSearchParams({
    bbox: bbox.join(","),
    bboxSR: "4326",
    imageSR: "3857",
    size: `${width},${height}`,
    format: "jpg",
    f: "image"
  });
  return `${ESRI}/export?${params.toString()}`;
}

// ── Plot frames ───────────────────────────────────────────────────────────────
// A plot photo is a Web Mercator still whose extent has exactly the aspect of
// the box it is shown in, so the outline drawn on top lines up pixel for pixel.

const R = 6378137;
const toX = (lon: number) => (R * lon * Math.PI) / 180;
const toY = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

export type PlotFrame = { src: string; path: string; width: number; height: number };

function rings(geometry: GeoJSON.Geometry): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates as number[][][];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).flat();
  return [];
}

/**
 * Satellite still around a plot plus its outline as an SVG path in a
 * `width × height` box. `pad` is the margin around the plot, as a share of its size.
 */
export function plotFrame(geometry: GeoJSON.Geometry, width: number, height: number, pad = 0.45): PlotFrame | null {
  const rs = rings(geometry).map((ring) => ring.map(([lon, lat]) => [toX(lon), toY(lat)] as const));
  const pts = rs.flat();
  if (!pts.length) return null;
  let minX = Math.min(...pts.map((p) => p[0]));
  let maxX = Math.max(...pts.map((p) => p[0]));
  let minY = Math.min(...pts.map((p) => p[1]));
  let maxY = Math.max(...pts.map((p) => p[1]));
  // Margin around the plot, never tighter than ~250 m so tiny plots keep context.
  const size = Math.max(maxX - minX, maxY - minY, 250);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let w = size * (1 + pad * 2);
  let h = w;
  const aspect = width / height;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  minX = cx - w / 2;
  maxX = cx + w / 2;
  minY = cy - h / 2;
  maxY = cy + h / 2;

  const sx = width / w;
  const path = rs
    .map((ring) => ring.map(([x, y], i) => `${i ? "L" : "M"}${((x - minX) * sx).toFixed(1)},${((maxY - y) * sx).toFixed(1)}`).join("") + "Z")
    .join("");
  // Twice the box size for sharp images on high-density screens, capped by the service.
  const scale = Math.min(2, 1024 / Math.max(width, height));
  const params = new URLSearchParams({
    bbox: [minX, minY, maxX, maxY].map((v) => v.toFixed(1)).join(","),
    bboxSR: "3857",
    imageSR: "3857",
    size: `${Math.round(width * scale)},${Math.round(height * scale)}`,
    format: "jpg",
    f: "image"
  });
  return { src: `${ESRI}/export?${params.toString()}`, path, width, height };
}

/** Farmland of the Mil plain (Ağcabədi–Ağdam): field patterns for hero backgrounds. */
export const HERO_FIELDS = satelliteStill([47.02, 39.98, 47.32, 40.14], 1920, 1080);
/** Centre-pivot and strip fields of the Mil plain, for the sign-in card. */
export const AUTH_FIELDS = satelliteStill([47.2, 40.0, 47.27, 40.105], 900, 1200);
