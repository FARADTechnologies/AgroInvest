import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";

/** Silhouette of a plot's outline, drawn from its GeoJSON (no map needed). */
export const AreaShape = memo(function AreaShape({
  geometry,
  color,
  className,
  strokeWidth = 1.6
}: {
  geometry: GeoJSON.Geometry | undefined;
  color: string;
  className?: string;
  strokeWidth?: number;
}) {
  const d = useMemo(() => {
    if (!geometry || !("coordinates" in geometry)) return null;
    const polys: number[][][][] =
      geometry.type === "MultiPolygon"
        ? (geometry.coordinates as number[][][][])
        : geometry.type === "Polygon"
          ? [geometry.coordinates as number[][][]]
          : [];
    const pts = polys.flat(2);
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // Shrink longitude by cos(latitude) so shapes keep their real proportions.
    const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
    const w = (maxX - minX) * k || 1e-6;
    const h = maxY - minY || 1e-6;
    const s = 84 / Math.max(w, h);
    const ox = (100 - w * s) / 2;
    const oy = (100 - h * s) / 2;
    return polys
      .map((poly) =>
        poly
          .map(
            (ring) =>
              ring
                .map((p, i) => `${i ? "L" : "M"}${(ox + (p[0] - minX) * k * s).toFixed(1)},${(oy + (maxY - p[1]) * s).toFixed(1)}`)
                .join("") + "Z"
          )
          .join("")
      )
      .join("");
  }, [geometry]);

  return (
    <svg viewBox="0 0 100 100" className={cn("size-full", className)} aria-hidden>
      {d && (
        <path
          d={d}
          fill={color}
          fillOpacity={0.35}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          fillRule="evenodd"
        />
      )}
    </svg>
  );
});
