"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { MapLayerMouseEvent } from "maplibre-gl";
import { useMemo, useState } from "react";
import Map, { Layer, NavigationControl, ScaleControl, Source } from "react-map-gl/maplibre";

import type { AreaFeatureCollection, MapContext } from "@/features/areas/api";
import { cn } from "@/lib/utils";

import { type BasemapKind, useBasemap } from "./basemap";

type Point = [number, number];

/** Geodesic area of a ring in hectares (spherical excess; ample for a preview). */
export function ringHectares(ring: Point[]): number {
  if (ring.length < 3) return 0;
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    sum += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((sum * R * R) / 2) / 10_000;
}

/**
 * Click on the map to place the corners of a plot; the polygon closes itself from the third
 * corner. Existing plots are shown so a new listing does not overlap them.
 */
export function DrawMap({
  context,
  existing,
  points,
  onChange,
  basemap = "map",
  className
}: {
  context?: MapContext;
  existing?: AreaFeatureCollection;
  points: Point[];
  onChange: (points: Point[]) => void;
  basemap?: BasemapKind;
  className?: string;
}) {
  const { style, online } = useBasemap(basemap);
  const satellite = basemap === "satellite" && online;
  const [cursor, setCursor] = useState("crosshair");

  const drawn = useMemo(() => {
    const features: GeoJSON.Feature[] = points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: p },
      properties: {}
    }));
    if (points.length >= 3) {
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
        properties: {}
      });
    } else if (points.length === 2) {
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {} });
    }
    return { type: "FeatureCollection", features } as GeoJSON.FeatureCollection;
  }, [points]);

  if (!style) return <div className={className} style={{ background: "#F1EEE8" }} />;

  const onClick = (e: MapLayerMouseEvent) => onChange([...points, [e.lngLat.lng, e.lngLat.lat]]);
  const bounds = context?.bounds ?? [45.4, 38.9, 47.9, 40.6];

  return (
    <div className={cn(className)} style={{ position: "relative" }}>
      <Map
        mapStyle={style}
        initialViewState={{ bounds: bounds as [number, number, number, number], fitBoundsOptions: { padding: 20 } }}
        style={{ width: "100%", height: "100%" }}
        onClick={onClick}
        onMouseDown={() => setCursor("grabbing")}
        onMouseUp={() => setCursor("crosshair")}
        cursor={cursor}
        doubleClickZoom={false}
        dragRotate={false}
        attributionControl={false}
        maxBounds={[42.5, 36.5, 51.5, 42.5]}
        minZoom={6.5}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-right" unit="metric" />
        {context?.mask && (
          <Source id="mask" type="geojson" data={context.mask}>
            <Layer id="mask-fill" type="fill" paint={{ "fill-color": "#E4DFD4", "fill-opacity": 0.94 }} />
          </Source>
        )}
        {context?.rayons && (
          <Source id="rayons" type="geojson" data={context.rayons}>
            <Layer
              id="rayons-line"
              type="line"
              paint={{ "line-color": satellite ? "#FFFFFF" : "#8C8577", "line-width": 0.9, "line-dasharray": [3, 2] }}
            />
          </Source>
        )}
        {existing && (
          <Source id="existing" type="geojson" data={existing}>
            <Layer id="existing-fill" type="fill" paint={{ "fill-color": "#8C8577", "fill-opacity": 0.25 }} />
            <Layer id="existing-line" type="line" paint={{ "line-color": "#6B6458", "line-width": 1 }} />
          </Source>
        )}
        <Source id="drawn" type="geojson" data={drawn}>
          <Layer id="drawn-fill" type="fill" filter={["==", "$type", "Polygon"]} paint={{ "fill-color": "#B8862B", "fill-opacity": 0.35 }} />
          <Layer
            id="drawn-line"
            type="line"
            filter={["!=", "$type", "Point"]}
            paint={{ "line-color": "#B8862B", "line-width": 2.5 }}
          />
          <Layer
            id="drawn-points"
            type="circle"
            filter={["==", "$type", "Point"]}
            paint={{ "circle-radius": 5, "circle-color": "#FFFFFF", "circle-stroke-color": "#B8862B", "circle-stroke-width": 2 }}
          />
        </Source>
      </Map>
    </div>
  );
}
