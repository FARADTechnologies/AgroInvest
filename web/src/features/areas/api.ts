"use client";

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

import type { AreaFilters } from "./filters";

export type AreaListItem = Schemas["AreaListItem"];
export type AreaDetail = Schemas["AreaDetail"];
export type AreaPage = Schemas["AreaPage"];
export type CompetitionSummary = Schemas["CompetitionSummary"];
export type CompetitionDetail = Schemas["CompetitionDetail"];

export type AreaFeatureProps = {
  id: string;
  code: string;
  purpose: "CROP" | "LIVESTOCK" | "ORCHARD" | "OTHER";
  area_ha: number;
  rayon: string;
  village: string | null;
  open: boolean;
  deadline_at: string | null;
  fao_class: "S1" | "S2" | "S3" | "N" | null;
  demining: "CLEARED" | "IN_PROGRESS" | "NOT_SURVEYED";
};

export type AreaFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, AreaFeatureProps>;

export type MapContext = {
  bounds: [number, number, number, number] | null;
  rayons: GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;
  rayon_labels: GeoJSON.FeatureCollection<GeoJSON.Point, { name: string }>;
  mask: GeoJSON.Feature | null;
};

function toQuery(f: AreaFilters) {
  return {
    purpose: f.purposes.length ? f.purposes : undefined,
    region: f.region || undefined,
    rayon_id: f.rayonId ?? undefined,
    min_ha: f.minHa ?? undefined,
    max_ha: f.maxHa ?? undefined,
    open_only: f.openOnly || undefined,
    q: f.q || undefined
  };
}

export function useAreas(f: AreaFilters, page = 1, size = 50) {
  return useQuery({
    queryKey: ["areas", f, page, size],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/areas", {
          params: { query: { ...toQuery(f), sort: f.sort, page, size } }
        })
      ),
    placeholderData: keepPreviousData
  });
}

export function useAreaFeatures(f: AreaFilters) {
  return useQuery({
    queryKey: ["area-features", { ...f, sort: undefined }],
    staleTime: 60_000,
    queryFn: async () =>
      (await unwrap(api.GET("/api/v1/areas/geojson", { params: { query: toQuery(f) } }))) as unknown as AreaFeatureCollection,
    placeholderData: keepPreviousData
  });
}

/** Shared by useArea and hover prefetching, so a click on a prefetched row opens instantly. */
export const areaQuery = (code: string) =>
  queryOptions({
    queryKey: ["area", code],
    queryFn: () => unwrap(api.GET("/api/v1/areas/{code}", { params: { path: { code } } })),
    staleTime: 60_000
  });

export function useArea(code: string) {
  return useQuery({ ...areaQuery(code), enabled: !!code });
}

export function useMapContext() {
  return useQuery({
    queryKey: ["map-context"],
    queryFn: async () => (await unwrap(api.GET("/api/v1/reference/map-context"))) as unknown as MapContext,
    staleTime: Infinity
  });
}

export function useRayons() {
  return useQuery({
    queryKey: ["rayons"],
    queryFn: () => unwrap(api.GET("/api/v1/reference/rayons")),
    staleTime: Infinity
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: () => unwrap(api.GET("/api/v1/reference/regions")),
    staleTime: Infinity
  });
}

export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: () => unwrap(api.GET("/api/v1/competitions"))
  });
}

export function useCompetition(number: string) {
  return useQuery({
    queryKey: ["competition", number],
    queryFn: () => unwrap(api.GET("/api/v1/competitions/{number}", { params: { path: { number } } })),
    enabled: !!number
  });
}

export function useCompareAreas(codes: string[]) {
  return useQuery({
    queryKey: ["compare", codes],
    queryFn: () => unwrap(api.GET("/api/v1/areas/compare", { params: { query: { codes: codes.join(",") } } })),
    enabled: codes.length > 0
  });
}

export function usePublicStats() {
  return useQuery({
    queryKey: ["public-stats"],
    queryFn: () => unwrap(api.GET("/api/v1/stats/public")),
    staleTime: 5 * 60_000
  });
}
