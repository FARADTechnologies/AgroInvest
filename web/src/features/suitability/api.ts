"use client";

import { useQuery } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type SuitabilityMethod = Schemas["MethodOut"];
export type ActivityMethod = Schemas["ActivityMethodOut"];
export type AhpMatrix = Schemas["MatrixOut"];

/** The method in force: AHP matrices, weights, CR, FAO thresholds and data sources. */
export function useSuitabilityMethod() {
  return useQuery({
    queryKey: ["suitability", "method"],
    queryFn: () => unwrap(api.GET("/api/v1/suitability/method")),
    staleTime: 60_000
  });
}

/** A Saaty value as an expert writes it: 3, 1, 1/3. */
export function saaty(value: number): string {
  if (value >= 1) return String(Math.round(value));
  return `1/${Math.round(1 / value)}`;
}
