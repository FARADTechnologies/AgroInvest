"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type SuitabilityMethod = Schemas["MethodOut"];
export type ActivityMethod = Schemas["ActivityMethodOut"];
export type AhpMatrix = Schemas["MatrixOut"];
export type MethodVersion = Schemas["VersionOut"];
export type MethodInput = Schemas["MethodIn"];

/** The method in force: AHP matrices, weights, CR, FAO thresholds and data sources. */
export function useSuitabilityMethod() {
  return useQuery({
    queryKey: ["suitability", "method"],
    queryFn: () => unwrap(api.GET("/api/v1/suitability/method")),
    staleTime: 60_000
  });
}

export function useMethodVersions() {
  return useQuery({
    queryKey: ["suitability", "versions"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/suitability/methods"))
  });
}

export function useDefaultMethod(enabled: boolean) {
  return useQuery({
    queryKey: ["suitability", "default"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/suitability/default")),
    enabled
  });
}

export function usePublishMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: MethodInput) => unwrap(api.POST("/api/v1/admin/suitability/methods", { body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suitability"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["area"] });
      qc.invalidateQueries({ queryKey: ["area-features"] });
    }
  });
}

/** A Saaty value as an expert writes it: 3, 1, 1/3. */
export function saaty(value: number): string {
  if (value >= 1) return String(Math.round(value));
  return `1/${Math.round(1 / value)}`;
}

/** The scale offered in the editor, strongest preference for the row first. */
export const SAATY_SCALE = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8, 1 / 9];

// Saaty's random index by matrix size.
const RANDOM_INDEX = [0, 0, 0, 0.58, 0.9, 1.12, 1.24, 1.32, 1.41, 1.45];

/** Principal-eigenvector weights and the consistency ratio, as the server computes them. */
export function ahp(matrix: number[][]): { weights: number[]; cr: number } {
  const n = matrix.length;
  if (n === 1) return { weights: [1], cr: 0 };
  let w = Array(n).fill(1 / n) as number[];
  for (let k = 0; k < 200; k++) {
    const next = matrix.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
    const total = next.reduce((s, v) => s + v, 0);
    w = next.map((v) => v / total);
  }
  if (n <= 2) return { weights: w, cr: 0 };
  const lambda = matrix.reduce((s, row, i) => s + row.reduce((t, v, j) => t + v * w[j], 0) / w[i], 0) / n;
  return { weights: w, cr: (lambda - n) / (n - 1) / RANDOM_INDEX[n] };
}
