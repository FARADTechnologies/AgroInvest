"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schemas, unwrap } from "@/lib/api/client";

export type Listing = Schemas["ListingOut"];
export type ListingInput = Schemas["ListingIn"];
export type ListingApplication = Schemas["ListingApplicationOut"];

export function useMyListings() {
  return useQuery({
    queryKey: ["listings", "mine"],
    queryFn: () => unwrap(api.GET("/api/v1/listings/mine"))
  });
}

export function useListingApplications() {
  return useQuery({
    queryKey: ["listings", "applications"],
    queryFn: () => unwrap(api.GET("/api/v1/listings/mine/applications"))
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ListingInput) => unwrap(api.POST("/api/v1/listings", { body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["area-features"] });
    }
  });
}

export function useWithdrawListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competitionId, reason }: { competitionId: string; reason: string }) =>
      unwrap(
        api.POST("/api/v1/listings/{competition_id}/withdraw", {
          params: { path: { competition_id: competitionId } },
          body: { reason }
        })
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      qc.invalidateQueries({ queryKey: ["area-features"] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
    }
  });
}
