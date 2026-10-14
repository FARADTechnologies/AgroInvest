"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type AdminCompetition = Schemas["AdminCompetition"];
export type CompetitionInput = Schemas["CompetitionInput"];
export type CompetitionStatus = AdminCompetition["status"];
export type AdminAreaRow = Schemas["AdminAreaRow"];
export type AdminAreaDetail = Schemas["AdminAreaDetail"];
export type AreaInput = Schemas["AreaInput"];
export type Stats = Schemas["Stats"];

// ── Competitions ───────────────────────────────────────────────────────────

export function useAdminCompetitions(status?: CompetitionStatus) {
  return useQuery({
    queryKey: ["admin-competitions", status],
    queryFn: () => unwrap(api.GET("/api/v1/admin/competitions", { params: { query: { status } } })),
    refetchInterval: 20_000
  });
}

export function useAdminCompetition(id: string) {
  return useQuery({
    queryKey: ["admin-competition", id],
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/competitions/{competition_id}", { params: { path: { competition_id: id } } })),
    enabled: !!id
  });
}

function useCompetitionMutation<V>(fn: (v: V) => Promise<AdminCompetition>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (c) => {
      qc.setQueryData(["admin-competition", c.id], c);
      qc.invalidateQueries({ queryKey: ["admin-competitions"] });
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["area-features"] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
    }
  });
}

export function useCreateCompetition() {
  return useCompetitionMutation((body: CompetitionInput) => unwrap(api.POST("/api/v1/admin/competitions", { body })));
}

export function useUpdateCompetition(id: string) {
  return useCompetitionMutation((body: CompetitionInput) =>
    unwrap(api.PUT("/api/v1/admin/competitions/{competition_id}", { params: { path: { competition_id: id } }, body }))
  );
}

export function useSubmitCompetition(id: string) {
  return useCompetitionMutation(() =>
    unwrap(api.POST("/api/v1/admin/competitions/{competition_id}/submit", { params: { path: { competition_id: id } } }))
  );
}

export function useApproveCompetition(id: string) {
  return useCompetitionMutation((comment: string) =>
    unwrap(
      api.POST("/api/v1/admin/competitions/{competition_id}/approve", {
        params: { path: { competition_id: id } },
        body: { comment: comment || null }
      })
    )
  );
}

export function useReturnCompetition(id: string) {
  return useCompetitionMutation((comment: string) =>
    unwrap(
      api.POST("/api/v1/admin/competitions/{competition_id}/return", {
        params: { path: { competition_id: id } },
        body: { comment }
      })
    )
  );
}

export function useLotResult(id: string) {
  return useCompetitionMutation((body: Schemas["LotResult"]) =>
    unwrap(api.POST("/api/v1/admin/competitions/{competition_id}/results", { params: { path: { competition_id: id } }, body }))
  );
}

// ── Areas ──────────────────────────────────────────────────────────────────

export function useAdminAreas(status?: AdminAreaRow["status"], q?: string) {
  return useQuery({
    queryKey: ["admin-areas", status, q],
    queryFn: () => unwrap(api.GET("/api/v1/admin/areas", { params: { query: { status, q: q || undefined } } }))
  });
}

export function useAdminArea(id: string | null) {
  return useQuery({
    queryKey: ["admin-area", id],
    queryFn: () => unwrap(api.GET("/api/v1/admin/areas/{area_id}", { params: { path: { area_id: id! } } })),
    enabled: !!id
  });
}

export function useSaveArea(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AreaInput) =>
      id
        ? unwrap(api.PATCH("/api/v1/admin/areas/{area_id}", { params: { path: { area_id: id } }, body }))
        : unwrap(api.POST("/api/v1/admin/areas", { body })),
    onSuccess: (a) => {
      qc.setQueryData(["admin-area", a.id], a);
      qc.invalidateQueries({ queryKey: ["admin-areas"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["area-features"] });
    }
  });
}

// ── Statistics ─────────────────────────────────────────────────────────────

export function useStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/stats")),
    refetchInterval: 30_000
  });
}
