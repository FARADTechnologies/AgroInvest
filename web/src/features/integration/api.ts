"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type IntegrationStatus = Schemas["IntegrationStatus"];
export type OutboxMessage = Schemas["OutboxOut"];
export type IntegrationLogEntry = Schemas["LogOut"];
export type FarmerCheck = Schemas["FarmerCheck"];

// The log screen is watched live during the demo, so it polls every few seconds.
const LIVE = 3_000;

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ["integration", "status"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/integration/status")),
    refetchInterval: LIVE
  });
}

export function useOutbox(applicationId?: string) {
  return useQuery({
    queryKey: ["integration", "outbox", applicationId ?? null],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/integration/outbox", {
          params: { query: { application_id: applicationId, limit: 50 } }
        })
      ),
    refetchInterval: LIVE
  });
}

export function useIntegrationLog() {
  return useQuery({
    queryKey: ["integration", "log"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/integration/log", { params: { query: { limit: 100 } } })),
    refetchInterval: LIVE
  });
}

export function useSetFault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mode: "NONE" | "DOWN") => unwrap(api.POST("/api/v1/admin/integration/fault", { body: { mode } })),
    onSuccess: (status) => {
      qc.setQueryData(["integration", "status"], status);
      qc.invalidateQueries({ queryKey: ["integration"] });
    }
  });
}

export function useResend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/admin/integration/outbox/{message_id}/retry", { params: { path: { message_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration"] })
  });
}

export function useEktisCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/me/entrepreneur/ektis-check")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] })
  });
}
