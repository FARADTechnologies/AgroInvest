"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, type Schemas, unwrap } from "@/lib/api/client";

export type Application = Schemas["ApplicationOut"];
export type ApplicationSummary = Schemas["ApplicationSummary"];
export type AdminPage = Schemas["AdminApplicationPage"];
export type BusinessPlan = Schemas["BusinessPlanData-Output"];
export type BusinessPlanInput = Schemas["BusinessPlanData-Input"];
export type Profile = Schemas["EntrepreneurOut"];
export type ProfileInput = Schemas["EntrepreneurIn"];
export type TransitionInput = Schemas["TransitionRequest"];
export type ApplicationStatus = Application["status"];

// ── Entrepreneur profile ───────────────────────────────────────────────────

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      try {
        return await unwrap(api.GET("/api/v1/me/entrepreneur"));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileInput) => unwrap(api.PUT("/api/v1/me/entrepreneur", { body })),
    onSuccess: (profile) => {
      qc.setQueryData(["profile"], profile);
      qc.invalidateQueries({ queryKey: ["session"] });
    }
  });
}

// ── Applications (entrepreneur) ────────────────────────────────────────────

export function useMyApplications() {
  return useQuery({
    queryKey: ["my-applications"],
    queryFn: () => unwrap(api.GET("/api/v1/applications"))
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: ["application", id],
    queryFn: () => unwrap(api.GET("/api/v1/applications/{application_id}", { params: { path: { application_id: id! } } })),
    enabled: !!id
  });
}

function useApplicationMutation<TVars>(fn: (vars: TVars) => Promise<Application>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (app) => {
      qc.setQueryData(["application", app.id], app);
      qc.invalidateQueries({ queryKey: ["my-applications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  });
}

export function useCreateDraft() {
  return useApplicationMutation((areaCode: string) =>
    unwrap(api.POST("/api/v1/applications", { body: { area_code: areaCode } }))
  );
}

export function useUpdateDraft(id: string) {
  return useApplicationMutation((body: Schemas["UpdateApplication"]) =>
    unwrap(api.PATCH("/api/v1/applications/{application_id}", { params: { path: { application_id: id } }, body }))
  );
}

/** Multipart upload; plain fetch so the browser sets the boundary. */
async function uploadDocument(id: string, docType: string, file: File): Promise<Application> {
  const form = new FormData();
  form.append("doc_type_code", docType);
  form.append("file", file);
  const response = await fetch(`/api/v1/applications/${id}/documents`, {
    method: "POST",
    body: form,
    credentials: "same-origin"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, body.title ?? "upload_failed", body.detail ?? "Fayl yüklənmədi", body.errors ?? []);
  }
  return body as Application;
}

export function useUploadDocument(id: string) {
  return useApplicationMutation(({ docType, file }: { docType: string; file: File }) =>
    uploadDocument(id, docType, file)
  );
}

export function useRemoveDocument(id: string) {
  return useApplicationMutation((documentId: string) =>
    unwrap(
      api.DELETE("/api/v1/applications/{application_id}/documents/{document_id}", {
        params: { path: { application_id: id, document_id: documentId } }
      })
    )
  );
}

export function useSubmit(id: string) {
  return useApplicationMutation(() =>
    unwrap(api.POST("/api/v1/applications/{application_id}/submit", { params: { path: { application_id: id } } }))
  );
}

export function useInfoResponse(id: string) {
  return useApplicationMutation((responseText: string) =>
    unwrap(
      api.POST("/api/v1/applications/{application_id}/info-response", {
        params: { path: { application_id: id } },
        body: { response_text: responseText }
      })
    )
  );
}

// ── Notifications ──────────────────────────────────────────────────────────

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => unwrap(api.GET("/api/v1/notifications")),
    enabled,
    refetchInterval: 15_000
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/notifications/{notification_id}/read", { params: { path: { notification_id: id } } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] })
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/notifications/read-all")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] })
  });
}

// ── Staff ──────────────────────────────────────────────────────────────────

export type AdminFilters = { status?: ApplicationStatus; q?: string; page: number };

export function useAdminApplications(f: AdminFilters) {
  return useQuery({
    queryKey: ["admin-applications", f],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/admin/applications", {
          params: { query: { status: f.status, q: f.q || undefined, page: f.page, size: 25 } }
        })
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000
  });
}

export function useAdminApplication(id: string) {
  return useQuery({
    queryKey: ["admin-application", id],
    queryFn: () =>
      unwrap(api.GET("/api/v1/admin/applications/{application_id}", { params: { path: { application_id: id } } })),
    refetchInterval: 15_000
  });
}

export function useTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TransitionInput) =>
      unwrap(
        api.POST("/api/v1/admin/applications/{application_id}/transitions", {
          params: { path: { application_id: id } },
          body
        })
      ),
    onSuccess: (app) => {
      qc.setQueryData(["admin-application", id], app);
      qc.invalidateQueries({ queryKey: ["admin-applications"] });
    }
  });
}
