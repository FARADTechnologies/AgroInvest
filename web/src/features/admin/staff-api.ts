"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type StaffMember = Schemas["StaffOut"];
export type StaffCreate = Schemas["StaffCreate"];
export type StaffUpdate = Schemas["StaffUpdate"];
export type PermissionInfo = Schemas["PermissionOut"];

export function usePermissionCatalogue() {
  return useQuery({
    queryKey: ["staff-permissions"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/users/permissions")),
    staleTime: Infinity
  });
}

export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/users"))
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StaffCreate) => unwrap(api.POST("/api/v1/admin/users", { body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] })
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: StaffUpdate }) =>
      unwrap(api.PATCH("/api/v1/admin/users/{user_id}", { params: { path: { user_id: id } }, body })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] })
  });
}

export function useResetStaffPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      unwrap(
        api.POST("/api/v1/admin/users/{user_id}/password", {
          params: { path: { user_id: id } },
          body: { password }
        })
      )
  });
}
