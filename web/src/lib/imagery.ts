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

/** Farmland of the Mil plain (Ağcabədi–Ağdam): field patterns for hero backgrounds. */
export const HERO_FIELDS = satelliteStill([47.02, 39.98, 47.32, 40.14], 1920, 1080);
/** Centre-pivot and strip fields of the Mil plain, for the sign-in card. */
export const AUTH_FIELDS = satelliteStill([47.2, 40.0, 47.27, 40.105], 900, 1200);
