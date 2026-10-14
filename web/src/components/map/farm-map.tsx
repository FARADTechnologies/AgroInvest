"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { ExpressionSpecification, MapLayerMouseEvent } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  AttributionControl,
  Layer,
  type MapRef,
  Marker,
  NavigationControl,
  ScaleControl,
  Source
} from "react-map-gl/maplibre";

import { PURPOSE_HEX } from "@/components/domain/purpose-chip";
import type { AreaFeatureCollection, AreaFeatureProps, MapContext } from "@/features/areas/api";
import { useT } from "@/lib/i18n";
import { cn, formatHectares } from "@/lib/utils";

import { type BasemapKind, WATER as WATER_HEX, useBasemap } from "./basemap";

export type MapMode = "purpose" | "suitability";

const PURPOSE_LINE: Record<string, string> = {
  CROP: "#9C7A22",
  LIVESTOCK: "#6E3F27",
  ORCHARD: "#33612A",
  OTHER: "#3F5163"
};

const SUIT_HEX = { S1: "#2F7A4A", S2: "#8DAF4E", S3: "#D9B547", N: "#B9B3A6" };
const ACCENT = "#B8862B";

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

function bboxOf(geometry: GeoJSON.Geometry): [number, number, number, number] {
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
  onSelect?: (code: string | null) => void;
  /** Static map (detail page): no hover card, no selection, fits the given features. */
  compact?: boolean;
  /** Satellite imagery is used only while online; offline the plain map is shown. */
  basemap?: BasemapKind;
  className?: string;
};

export function FarmMap({
  features,
  context,
  selectedCode = null,
  highlightCode = null,
  mode = "purpose",
  onSelect,
  compact = false,
  basemap = "map",
  className
}: Props) {
  const t = useT();
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

  // Keep feature-state in sync with selection and list hover coming from outside the map.
  useEffect(() => {
    if (!loaded) return;
    setState(previous.current.selected, { selected: false });
    setState(selectedCode, { selected: true });
    setState(previous.current.highlight, { hover: false });
    setState(highlightCode, { hover: true });
    previous.current = { selected: selectedCode, highlight: highlightCode };
  }, [selectedCode, highlightCode, loaded, features, setState]);

  // Fly to an area selected elsewhere (list click, detail page).
  useEffect(() => {
    if (!loaded || !selectedCode || !features) return;
    const feature = features.features.find((f) => f.properties.code === selectedCode);
    if (!feature) return;
    const [minX, minY, maxX, maxY] = bboxOf(feature.geometry);
    // Leave room for the floating card on wide maps only; padding wider than the map makes fitBounds a no-op.
    const width = mapRef.current?.getContainer().clientWidth ?? 0;
    mapRef.current?.fitBounds([minX, minY, maxX, maxY], {
      padding: compact ? 40 : { top: 60, bottom: 60, left: 60, right: width > 900 ? 420 : 60 },
      maxZoom: 14,
      duration: compact ? 0 : 900
    });
  }, [selectedCode, loaded, features, compact]);

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

  const initialBounds = useMemo(() => {
    if (compact && features?.features.length) {
      const [minX, minY, maxX, maxY] = bboxOf(features.features[0].geometry);
      const pad = Math.max(maxX - minX, maxY - minY) * 0.9 + 0.006;
      return [minX - pad, minY - pad, maxX + pad, maxY + pad];
    }
    return context?.bounds ?? [45.6, 38.85, 47.8, 40.55];
  }, [compact, features, context]);

  const onMove = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) {
      setHover(null);
      return;
    }
    setHover({ x: e.point.x, y: e.point.y, props: f.properties as unknown as AreaFeatureProps });
  }, []);

  const onClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const code = (e.features?.[0]?.properties as AreaFeatureProps | undefined)?.code ?? null;
      onSelect?.(code);
    },
    [onSelect]
  );

  if (!style) return <div className={className} style={{ background: "#F1EEE8" }} />;

  return (
    <div className={cn(className, compact && "map-compact")} style={{ position: "relative" }}>
      <Map
        ref={mapRef}
        mapStyle={style}
        initialViewState={{ bounds: initialBounds as [number, number, number, number], fitBoundsOptions: { padding: 30 } }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={compact ? [] : ["areas-fill", "areas-dots"]}
        onMouseMove={compact ? undefined : onMove}
        onMouseLeave={() => setHover(null)}
        onClick={compact ? undefined : onClick}
        onLoad={() => setLoaded(true)}
        cursor={hover ? "pointer" : "grab"}
        attributionControl={false}
        dragRotate={false}
        maxBounds={[42.5, 36.5, 51.5, 42.5]}
        minZoom={6.5}
      >
        {!compact && <NavigationControl position="top-right" showCompass={false} />}
        <ScaleControl position="bottom-right" unit="metric" />
        <AttributionControl
          compact
          position="bottom-right"
          customAttribution='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
        />

        {/* The imagery shows the sea itself; the flat fill is for the drawn map. */}
        {context?.water && !satellite && (
          <Source id="water" type="geojson" data={context.water}>
            <Layer id="water-fill" type="fill" paint={{ "fill-color": WATER_HEX }} />
          </Source>
        )}

        {context?.mask && (
          <Source id="mask" type="geojson" data={context.mask}>
            <Layer id="mask-fill" type="fill" paint={{ "fill-color": "#E4DFD4", "fill-opacity": 0.94 }} />
            <Layer id="mask-line" type="line" paint={{ "line-color": "#9A9284", "line-width": 1.2 }} />
          </Source>
        )}

        {context?.rayons && (
          <Source id="rayons" type="geojson" data={context.rayons}>
            <Layer
              id="rayons-line"
              type="line"
              paint={{
                "line-color": satellite ? "#FFFFFF" : "#8C8577",
                "line-width": 0.9,
                "line-opacity": satellite ? 0.85 : 0.75,
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
                "fill-color": mode === "suitability" ? suitabilityFill : purposeFill,
                // On imagery the fill stays light so the ground inside the plot remains visible.
                "fill-opacity": [
                  "case",
                  ["any", ["boolean", ["feature-state", "selected"], false], ["boolean", ["feature-state", "hover"], false]],
                  satellite ? 0.35 : 0.9,
                  ["!=", ["get", "demining"], "CLEARED"],
                  satellite ? 0.12 : 0.18,
                  ["get", "open"],
                  satellite ? 0.3 : 0.62,
                  satellite ? 0.2 : 0.32
                ]
              }}
            />
            <Layer
              id="areas-line"
              type="line"
              filter={["==", ["get", "demining"], "CLEARED"]}
              paint={{
                // On imagery a white edge keeps small plots visible; the fill still carries the purpose.
                "line-color": [
                  "case",
                  ["boolean", ["feature-state", "selected"], false],
                  ACCENT,
                  satellite ? "#FFFFFF" : purposeLine
                ],
                "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, satellite ? 1.4 : 1]
              }}
            />
            <Layer
              id="areas-demining-line"
              type="line"
              filter={["!=", ["get", "demining"], "CLEARED"]}
              paint={{ "line-color": "#8A4B05", "line-width": 1.4, "line-dasharray": [2, 1.5] }}
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
                "circle-color": mode === "suitability" ? suitabilityFill : purposeFill,
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4.5, 11, 6],
                "circle-stroke-color": "#FFFFFF",
                "circle-stroke-width": 1.5,
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
              <span className="whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.08em] text-ink-2 [text-shadow:0_0_3px_#F1EEE8,0_0_3px_#F1EEE8,0_0_2px_#F1EEE8]">
                {f.properties.name}
              </span>
            </Marker>
          ))}
      </Map>

      {hover && !compact && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface px-2.5 py-1.5 text-13 shadow-popover"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <div className="font-mono text-2xs text-ink-3">{hover.props.code}</div>
          <div className="font-medium">
            {t.purpose[hover.props.purpose]} · {formatHectares(hover.props.area_ha)}
          </div>
          <div className="text-ink-2">
            {hover.props.village ? `${hover.props.village}, ` : ""}
            {hover.props.rayon}
          </div>
          {hover.props.demining !== "CLEARED" && (
            <div className="mt-0.5 text-status-info-fg">Minatəmizləmə davam edir</div>
          )}
        </div>
      )}
    </div>
  );
}
