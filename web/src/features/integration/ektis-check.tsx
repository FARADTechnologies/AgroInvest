"use client";

import { BadgeCheck, CircleAlert, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError, type Schemas } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, formatDate, formatHectares } from "@/lib/utils";

import { useEktisCheck } from "./api";

type Profile = Schemas["EntrepreneurOut"];

/**
 * Lets the applicant check their own FİN/VÖEN in the EKTIS farmer registry.
 * Informative only: applying never depends on it, and an EKTIS outage never blocks.
 */
export function EktisCheck({ profile, className }: { profile: Profile; className?: string }) {
  const t = useT();
  const check = useEktisCheck();
  const result = check.data;
  const registeredId = result ? (result.registered ? result.farmer_id : null) : profile.ektis_farmer_id;
  const identifier = profile.type === "COMPANY" ? "VÖEN" : "FİN";

  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm",
        registeredId ? "border-status-won-fg/30 bg-status-won-bg" : "border-border bg-surface-2/60",
        className
      )}
    >
      <div className="flex min-w-0 gap-3">
        {registeredId ? (
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-status-won-fg" aria-hidden />
        ) : result && !result.available ? (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-info-fg" aria-hidden />
        ) : (
          <Database className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
        )}
        <div className="min-w-0">
          <div className="font-medium">EKTİS fermer reyestri</div>
          {registeredId ? (
            <div className="text-ink-2">
              Fermer kimi qeydiyyatdadır: <span className="font-mono text-ink">{registeredId}</span>
              {result?.registered && (
                <span className="block text-13">
                  {result.registered_on && <>Qeydiyyat: {formatDate(result.registered_on)} · </>}
                  {result.declared_land_ha && <>Bəyan edilmiş torpaq: {formatHectares(Number(result.declared_land_ha))} · </>}
                  {result.activities.map((a) => t.purpose[a as keyof typeof t.purpose] ?? a).join(", ")}
                </span>
              )}
            </div>
          ) : result ? (
            <div className={result.available ? "text-ink-2" : "text-status-info-fg"}>{result.message}</div>
          ) : (
            <div className="text-ink-2">
              {identifier} üzrə EKTİS-də fermer qeydiyyatınızı yoxlaya bilərsiniz. Müraciət üçün məcburi deyil.
            </div>
          )}
          {check.error && (
            <div className="text-13 text-danger">{check.error instanceof ApiError ? check.error.message : "Xəta baş verdi"}</div>
          )}
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" disabled={check.isPending} onClick={() => check.mutate()}>
        {check.isPending ? "Yoxlanılır…" : registeredId ? "Yenidən yoxla" : "EKTİS-də yoxla"}
      </Button>
    </div>
  );
}
