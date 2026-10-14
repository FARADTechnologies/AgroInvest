"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type SessionUser = Schemas["UserOut"];
export type Role = SessionUser["role"];

export const STAFF_ROLES: Role[] = ["SPECIALIST", "SUPERVISOR", "ADMIN"];

export function isStaff(user: SessionUser | null | undefined): boolean {
  return !!user && STAFF_ROLES.includes(user.role);
}

/** Where a user lands after signing in. */
export function homeFor(user: SessionUser): string {
  return isStaff(user) ? "/admin/applications" : "/cabinet";
}

/** The signed-in user, or null for visitors. */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await unwrap(api.GET("/api/v1/auth/session"))).user ?? null,
    staleTime: 60_000
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      unwrap(api.POST("/api/v1/auth/login", { body })),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(["session"], user);
    }
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["RegisterRequest"]) => unwrap(api.POST("/api/v1/auth/register", { body })),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(["session"], user);
    }
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/logout")),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(["session"], null);
    }
  });
}
