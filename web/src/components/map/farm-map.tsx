"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { MapLayerMouseEvent } from "maplibre-gl";
import { Sprout } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  AttributionControl,
  type FillLayer,
  type MapStyle,
  Layer,
  type MapRef,
  Marker,
  NavigationControl,
  ScaleControl,
  Source
} from "react-map-gl/maplibre";

import { PURPOSE_HEX } from "@/components/domain/purpose-chip";
import type { AreaFeatureCollection, AreaFeatureProps, MapContext } from "@/features/areas/api";
import { useL, useT } from "@/lib/i18n";
import { SATELLITE_ATTRIBUTION } from "@/lib/imagery";
import { cn, formatHectares } from "@/lib/utils";

import { type Basemap, PAPER, useBasemap } from "./basemap";

export type MapMode = "purpose" | "suitability";

// Expressions typed against react-map-gl's own copy of the style spec.
type ExpressionSpecification = Extract<NonNullable<NonNullable<FillLayer["paint"]>["fill-color"]>, unknown[]>;

const PURPOSE_LINE: Record<string, string> = {
  CROP: "#A67C14",
  LIVESTOCK: "#7A4122",
  ORCHARD: "#2F6E1F",
  OTHER: "#3C5878"
};

export const SUIT_HEX = { S1: "#228B4C", S2: "#8DBE48", S3: "#E6BE46", N: "#B9B6AA" };
const LIME = "#C6F36B";

const purposeFill: ExpressionSpecification = [
  "match",
  ["get", "purpose"],
  "CROP", PURPOSE_HEX.CROP,
  "LIVESTOCK", PURPOSE_HEX.LIVESTOCK,
  "ORCHARD", PURPOSE_HEX.ORCHARD,
  PURPOSE_HEX.OTHER
];

const suitabilityFill: ExpressionSpecification = [
  "match",
  ["coalesce", ["get", "fao_class"], "none"],
  "S1", SUIT_HEX.S1,
  "S2", SUIT_HEX.S2,
  "S3", SUIT_HEX.S3,
  "N", SUIT_HEX.N,
  "#CFC9BD"
];

const purposeLine: ExpressionSpecification = [
  "match",
  ["get", "purpose"],
  "CROP", PURPOSE_LINE.CROP,
  "LIVESTOCK", PURPOSE_LINE.LIVESTOCK,
  "ORCHARD", PURPOSE_LINE.ORCHARD,
  PURPOSE_LINE.OTHER
];

export function bboxOf(geometry: GeoJSON.Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as [number, number];
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  if ("coordinates" in geometry) walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

type Props = {
  features: AreaFeatureCollection | undefined;
  context: MapContext | undefined;
  selectedCode?: string | null;
  highlightCode?: string | null;
  mode?: MapMode;
  basemap?: Basemap;
  onSelect?: (code: string | null) => void;
  /** Reports the area under the pointer, so lists can mirror the map hover. */
  onHover?: (code: string | null) => void;
  /** Right-hand padding when fitting a selected area, to keep it clear of a floating card. */
  sidePadding?: number;
  /** Left-hand padding when fitting, for a floating panel on the left. */
  leftPadding?: number;
  /** Static map (detail page): no hover card, no selection, fits the given features. */
  compact?: boolean;
  className?: string;
};

export function FarmMap({
  features,
  context,
  selectedCode = null,
  highlightCode = null,
  mode = "purpose",
  basemap = "map",
  onSelect,
  onHover,
  sidePadding = 420,
  leftPadding = 60,
  compact = false,
  className
}: Props) {
  const t = useT();
  const L = useL();
  const mapRef = useRef<MapRef | null>(null);
  const { style, online } = useBasemap(basemap);
  const satellite = basemap === "satellite" && online;
  const [hover, setHover] = useState<{ x: number; y: number; props: AreaFeatureProps } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const previous = useRef<{ selected: string | null; highlight: string | null }>({ selected: null, highlight: null });

  const setState = useCallback((code: string | null, state: Record<string, boolean>) => {
    const map = mapRef.current?.getMap();
    if (!map || !code || !map.getSource("areas")) return;
    map.setFeatureState({ source: "areas", id: code }, state);
  }, []);

  // A style switch drops feature-state; re-apply it once the new style is in.
  const [styleTick, setStyleTick] = useState(0);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    const onStyle = () => {
      previous.current = { selected: null, highlight: null };
      setStyleTick((n) => n + 1);
    };
    map.on("style.load", onStyle);
    return () => {
      map.off("style.load", onStyle);
    };
  }, [loaded]);

  // Keep feature-state in sync with selection and list hover coming from outside the map.
  useEffect(() => {
    if (!loaded) return;
    setState(previous.current.selected, { selected: false });
    setState(selectedCode, { selected: true });
    setState(previous.current.highlight, { hover: false });
    setState(highlightCode, { hover: true });
    previous.current = { selected: selectedCode, highlight: highlightCode };
  }, [selectedCode, highlightCode, loaded, features, setState, styleTick]);

  const selectedFeature = useMemo(
    () => (selectedCode ? features?.features.find((f) => f.properties.code === selectedCode) : undefined),
    [features, selectedCode]
  );

  // Fly to an area selected elsewhere (list click, detail page).
  useEffect(() => {
    if (!loaded || !selectedFeature) return;
    const [minX, minY, maxX, maxY] = bboxOf(selectedFeature.geometry);
    // Leave room for the floating card on wide maps only; padding wider than the map makes fitBounds a no-op.
    const width = mapRef.current?.getContainer().clientWidth ?? 0;
    mapRef.current?.fitBounds([minX, minY, maxX, maxY], {
      padding: compact
        ? 40
        : width > 1100
          ? { top: 80, bottom: 80, left: leftPadding, right: sidePadding }
          : { top: 60, bottom: 60, left: 40, right: 40 },
      maxZoom: 14.5,
      duration: compact ? 0 : 1100
    });
  }, [selectedFeature, loaded, compact, sidePadding, leftPadding]);

  // At region scale the plots are a few pixels wide, so each is also drawn as a dot
  // that fades out as the polygons become readable.
  const points = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, AreaFeatureProps> | undefined>(() => {
    if (!features) return undefined;
    return {
      type: "FeatureCollection",
      features: features.features.map((f) => {
        const [minX, minY, maxX, maxY] = bboxOf(f.geometry);
        return {
          type: "Feature",
          properties: f.properties,
          geometry: { type: "Point", coordinates: [(minX + maxX) / 2, (minY + maxY) / 2] }
        };
      })
    };
  }, [features]);

  const selectedCentre = useMemo(() => {
    if (!selectedFeature) return null;
    const [minX, minY, maxX, maxY] = bboxOf(selectedFeature.geometry);
    return [(minX + maxX) / 2, (minY + maxY) / 2] as [number, number];
  }, [selectedFeature]);

  const initialBounds = useMemo(() => {
    if (compact && features?.features.length) {
      const [minX, minY, maxX, maxY] = bboxOf(features.features[0].geometry);
      const pad = Math.max(maxX - minX, maxY - minY) * 0.9 + 0.006;
      return [minX - pad, minY - pad, maxX + pad, maxY + pad];
    }
    return context?.bounds ?? [45.6, 38.85, 47.8, 40.55];
    // Only the first value matters: later changes must not move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, !!features, !!context]);

  const onMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) {
        setHover(null);
        onHover?.(null);
        return;
      }
      const props = f.properties as unknown as AreaFeatureProps;
      setHover({ x: e.point.x, y: e.point.y, props });
      onHover?.(props.code);
    },
    [onHover]
  );

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const code = (e.features?.[0]?.properties as AreaFeatureProps | undefined)?.code ?? null;
      onSelect?.(code);
    },
    [onSelect]
  );

  if (!style) return <div className={cn("animate-pulse", className)} style={{ background: PAPER }} />;

  const fill = mode === "suitability" ? suitabilityFill : purposeFill;
  const isActive: ExpressionSpecification = [
    "any",
    ["boolean", ["feature-state", "selected"], false],
    ["boolean", ["feature-state", "hover"], false]
  ];

  return (
    <div className={cn(className, compact && "map-compact")} style={{ position: "relative" }}>
      <Map
        ref={mapRef}
        mapStyle={style as unknown as MapStyle}
        initialViewState={{ bounds: initialBounds as [number, number, number, number], fitBoundsOptions: { padding: 30 } }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={compact ? [] : ["areas-fill", "areas-dots"]}
        onMouseMove={compact ? undefined : onMove}
        onMouseLeave={() => {
          setHover(null);
          onHover?.(null);
        }}
        onClick={compact ? undefined : onClick}
        onLoad={() => setLoaded(true)}
        cursor={hover ? "pointer" : "grab"}
        attributionControl={false}
        dragRotate={false}
        maxBounds={[42.5, 36.5, 51.5, 42.5]}
        minZoom={6.5}
        maxZoom={17}
      >
        {!compact && <NavigationControl position="top-right" showCompass={false} />}
        <ScaleControl position="bottom-right" unit="metric" />
        <AttributionControl
          compact
          position="bottom-right"
          customAttribution={satellite ? `© OpenStreetMap · ${SATELLITE_ATTRIBUTION}` : "© OpenStreetMap"}
        />

        {context?.mask && (
          <Source id="mask" type="geojson" data={context.mask}>
            <Layer
              id="mask-fill"
              type="fill"
              paint={{ "fill-color": satellite ? "#0D261B" : "#E2E6DC", "fill-opacity": satellite ? 0.62 : 0.94 }}
            />
            <Layer
              id="mask-line"
              type="line"
              paint={{ "line-color": satellite ? "#FFFFFF" : "#8F9A8A", "line-width": 1.2, "line-opacity": satellite ? 0.6 : 1 }}
            />
          </Source>
        )}

        {context?.rayons && (
          <Source id="rayons" type="geojson" data={context.rayons}>
            <Layer
              id="rayons-line"
              type="line"
              paint={{
                "line-color": satellite ? "#FFFFFF" : "#7F8A7A",
                "line-width": 1,
                "line-opacity": satellite ? 0.55 : 0.7,
                "line-dasharray": [3, 2]
              }}
            />
          </Source>
        )}

        {features && (
          <Source id="areas" type="geojson" data={features} promoteId="code">
            <Layer
              id="areas-fill"
              type="fill"
              paint={{
                "fill-color": fill,
                "fill-opacity": [
                  "case",
                  isActive,
                  satellite ? 0.55 : 0.9,
                  ["!=", ["get", "demining"], "CLEARED"],
                  0.18,
                  ["get", "open"],
                  satellite ? 0.38 : 0.62,
                  satellite ? 0.22 : 0.32
                ]
              }}
            />
            <Layer
              id="areas-line"
              type="line"
              filter={["==", ["get", "demining"], "CLEARED"]}
              paint={{
                "line-color": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  LIME,
                  satellite ? fill : purposeLine
                ],
                "line-width": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  3.5,
                  ["boolean", ["feature-state", "hover"], false],
                  2.5,
                  satellite ? 1.8 : 1
                ]
              }}
            />
            {/* Vertex dots on the selected plot, as in field-mapping tools. */}
            <Layer
              id="areas-vertices"
              type="circle"
              filter={["==", ["get", "code"], selectedCode ?? ""]}
              paint={{
                "circle-radius": 3.5,
                "circle-color": "#FFFFFF",
                "circle-stroke-color": "#13432F",
                "circle-stroke-width": 1.5
              }}
            />
            <Layer
              id="areas-demining-line"
              type="line"
              filter={["!=", ["get", "demining"], "CLEARED"]}
              paint={{ "line-color": satellite ? "#FFB547" : "#924C00", "line-width": 1.6, "line-dasharray": [2, 1.5] }}
            />
          </Source>
        )}

        {points && !compact && (
          <Source id="area-points" type="geojson" data={points}>
            <Layer
              id="areas-dots"
              type="circle"
              maxzoom={11.5}
              paint={{
                "circle-color": fill,
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 5, 11, 7],
                "circle-stroke-color": "#FFFFFF",
                "circle-stroke-width": 2,
                "circle-opacity": [
                  "interpolate", ["linear"], ["zoom"],
                  10, ["case", ["!=", ["get", "demining"], "CLEARED"], 0.45, ["get", "open"], 1, 0.6],
                  11.5, 0
                ],
                "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 10, 1, 11.5, 0]
              }}
            />
          </Source>
        )}

        {!compact && selectedCentre && (
          <Marker longitude={selectedCentre[0]} latitude={selectedCentre[1]} anchor="bottom" style={{ pointerEvents: "none" }}>
            <span className="relative flex flex-col items-center">
              <span className="absolute -bottom-1 size-4 rounded-full bg-accent/60 animate-ping" aria-hidden />
              <span className="relative flex size-9 items-center justify-center rounded-full border-[3px] border-white bg-primary text-accent shadow-float">
                <Sprout className="size-4" aria-hidden />
              </span>
              <span className="relative -mt-0.5 h-2 w-0.5 bg-white" aria-hidden />
            </span>
          </Marker>
        )}

        {!compact &&
          context?.rayon_labels.features.map((f) => (
            <Marker
              key={f.properties.name}
              longitude={f.geometry.coordinates[0]}
              latitude={f.geometry.coordinates[1]}
              anchor={f.properties.name === "Xankəndi" ? "top" : "center"}
              offset={f.properties.name === "Xankəndi" ? [0, 6] : [0, 0]}
              style={{ pointerEvents: "none" }}
            >
              <span
                className={cn(
                  "whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.12em]",
                  satellite
                    ? "text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8),0_0_8px_rgb(0_0_0/0.5)]"
                    : "text-ink-2 [text-shadow:0_0_3px_#EEF1E9,0_0_3px_#EEF1E9,0_0_2px_#EEF1E9]"
                )}
              >
                {f.properties.name}
              </span>
            </Marker>
          ))}
      </Map>

      {hover && !compact && (
        <div
          className="glass-dark pointer-events-none absolute z-10 min-w-44 rounded-2xl px-3 py-2 text-13"
          style={{ left: hover.x + 16, top: hover.y + 16 }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-2xs text-white/60">{hover.props.code}</span>
            {hover.props.fao_class && (
              <span className="rounded-full bg-white/15 px-1.5 font-mono text-2xs">{hover.props.fao_class}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-semibold">
            <span className="size-2 rounded-full" style={{ background: PURPOSE_HEX[hover.props.purpose] }} aria-hidden />
            {t.purpose[hover.props.purpose]} · {formatHectares(hover.props.area_ha)}
          </div>
          <div className="text-white/70">
            {hover.props.village ? `${hover.props.village}, ` : ""}
            {hover.props.rayon}
          </div>
          {hover.props.demining !== "CLEARED" ? (
            <div className="mt-1 text-[#FFC877]">{L("Minatəmizləmə davam edir", "Demining in progress")}</div>
          ) : (
            hover.props.open && <div className="mt-1 font-medium text-accent">{L("Müsabiqə açıqdır", "Open for applications")}</div>
          )}
        </div>
      )}
    </div>
  );
}
