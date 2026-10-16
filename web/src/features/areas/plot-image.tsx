"use client";

import { memo, useMemo, useState } from "react";

import { plotFrame } from "@/lib/imagery";
import { cn } from "@/lib/utils";

/**
 * A plot seen from above: a satellite still of the ground around it with the
 * plot's boundary drawn on top. The box keeps the frame's aspect ratio; while
 * the photo loads (or when offline) a field-stripe texture shows instead.
 */
export const PlotImage = memo(function PlotImage({
  geometry,
  color,
  width,
  height,
  pad,
  strokeWidth = 2,
  className,
  children
}: {
  geometry: GeoJSON.Geometry | undefined;
  color: string;
  /** Frame size in CSS pixels; the element is responsive but keeps this aspect. */
  width: number;
  height: number;
  pad?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const frame = useMemo(() => (geometry ? plotFrame(geometry, width, height, pad) : null), [geometry, width, height, pad]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-[#2E4A33]", className)} style={{ aspectRatio: `${width} / ${height}` }}>
      <span
        className={cn("absolute inset-0 transition-opacity duration-500", loaded && !failed ? "opacity-0" : "opacity-40")}
        style={{ backgroundImage: "repeating-linear-gradient(115deg, #4E6B3F 0 6px, #3A5530 6px 14px)" }}
        aria-hidden
      />
      {frame && !failed && (
        <img
          src={frame.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 size-full object-fill transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
        />
      )}
      {frame && (
        <svg viewBox={`0 0 ${frame.width} ${frame.height}`} className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
          {/* Dark halo first, so the outline reads on bright and dark ground alike. */}
          <path d={frame.path} fill="none" stroke="rgb(0 0 0 / 0.45)" strokeWidth={strokeWidth + 2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path
            d={frame.path}
            fill={color}
            fillOpacity={0.28}
            fillRule="evenodd"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {children}
    </div>
  );
});
