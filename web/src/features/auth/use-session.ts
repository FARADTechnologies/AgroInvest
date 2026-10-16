"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type SessionUser = Schemas["UserOut"];
export type Role = SessionUser["role"];

export const STAFF_ROLES: Role[] = ["SPECIALIST", "SUPERVISOR", "STAFF", "ADMIN"];

/** What the administration console lets a staff member do (mirrors the API's permissions). */
export type Permission =
  | "APPLICATIONS_VIEW"
  | "APPLICATIONS_DECIDE"
  | "IDENTIFIER_REVEAL"
  | "AREAS_MANAGE"
  | "COMPETITIONS_MANAGE"
  | "COMPETITIONS_APPROVE"
  | "LISTINGS_MANAGE"
  | "STATS_VIEW"
  | "SUITABILITY_MANAGE"
  | "INTEGRATION_MANAGE"
  | "AUDIT_VIEW";

// Used when the session carries no list (older API or the offline mock).
const ROLE_DEFAULTS: Partial<Record<Role, Permission[]>> = {
  SPECIALIST: [
    "APPLICATIONS_VIEW",
    "APPLICATIONS_DECIDE",
    "IDENTIFIER_REVEAL",
    "AREAS_MANAGE",
    "COMPETITIONS_MANAGE",
    "STATS_VIEW",
    "SUITABILITY_MANAGE",
    "INTEGRATION_MANAGE"
  ],
  SUPERVISOR: ["APPLICATIONS_VIEW", "COMPETITIONS_APPROVE", "STATS_VIEW", "AUDIT_VIEW"]
};

export function can(user: SessionUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const granted = user.permissions?.length ? user.permissions : ROLE_DEFAULTS[user.role] ?? [];
  return granted.includes(permission);
}

export function isStaff(user: SessionUser | null | undefined): boolean {
  return !!user && STAFF_ROLES.includes(user.role);
}

/** Where a user lands after signing in: staff in the administration console, everyone else
 * in the catalogue. */
export function homeFor(user: SessionUser): string {
  return isStaff(user) ? "/admin" : "/catalogue";
}

/** Portal users apply; staff do not. Visitors see the button and are asked to sign in. */
export function useCanApply(): boolean {
  const { data: user } = useSession();
  return !user || user.role === "INVESTOR";
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
