"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX } from "lucide-react";

import { RequireRole } from "@/components/layout/require-role";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { api, unwrap } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn, formatDateTime } from "@/lib/utils";

const ACTION: Record<string, string> = {
  "application.view": "Müraciətə baxış",
  "application.transition": "Status dəyişikliyi",
  "application.reveal_identifier": "FİN/VÖEN tam göstərildi",
  "document.download": "Sənəd yükləndi",
  "competition.create": "Müsabiqə yaradıldı",
  "competition.update": "Müsabiqə dəyişdirildi",
  "competition.submit": "Təsdiqə göndərildi",
  "competition.approve": "Müsabiqə təsdiqləndi",
  "competition.return": "Düzəlişə qaytarıldı",
  "competition.lot_result": "Sahə üzrə nəticə",
  "area.create": "Sahə əlavə edildi",
  "area.update": "Sahə dəyişdirildi",
  "report.export": "Hesabat ixrac edildi",
  "integration.fault": "EKTİS nasazlıq simulyasiyası",
  "integration.retry": "EKTİS-ə yenidən göndərmə",
  "suitability.method": "Uyğunluq metodu dəyişdirildi",
  "access.denied": "İcazəsiz cəhd"
};

const ACTION_EN: Record<string, string> = {
  "application.view": "Application viewed",
  "application.transition": "Status changed",
  "application.reveal_identifier": "FİN/VÖEN shown in full",
  "document.download": "Document downloaded",
  "competition.create": "Competition created",
  "competition.update": "Competition changed",
  "competition.submit": "Sent for approval",
  "competition.approve": "Competition approved",
  "competition.return": "Returned for changes",
  "competition.lot_result": "Result for a plot",
  "area.create": "Plot added",
  "area.update": "Plot changed",
  "report.export": "Report exported",
  "integration.fault": "EKTİS outage simulated",
  "integration.retry": "Resent to EKTİS",
  "suitability.method": "Suitability method changed",
  "access.denied": "Access denied"
};

function useAudit() {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/audit", { params: { query: { limit: 200 } } })),
    refetchInterval: 10_000
  });
}

function AuditView() {
  const L = useL();
  const { data } = useAudit();
  const verify = useMutation({ mutationFn: () => unwrap(api.GET("/api/v1/admin/audit/verify")) });
  const result = verify.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl">{L("Audit jurnalı", "Audit log")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {L(
            "Mütəxəssislərin hərəkətləri və fərdi məlumatlara hər müraciət. Jurnal yalnız əlavə olunur: qeydlər dəyişdirilə və silinə bilməz, hər qeyd SHA-256 heş zəncirinə bağlanır. Zəncirin yoxlanışı istənilən dəyişikliyi və ya silinməni aşkar edir.",
            "Staff actions and every access to personal data. The log is append-only: entries cannot be changed or deleted, and each is linked into a SHA-256 hash chain. Verifying the chain reveals any change or deletion."
          )}
        </p>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-4">
          {result ? (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-md",
                  result.valid ? "bg-status-won-bg text-status-won-fg" : "bg-status-rejected-bg text-status-rejected-fg"
                )}
              >
                {result.valid ? <ShieldCheck className="size-5" aria-hidden /> : <ShieldX className="size-5" aria-hidden />}
              </span>
              <div>
                <div className="text-15 font-semibold">
                  {result.valid ? L("Zəncir bütövdür", "The chain is intact") : L("Zəncir pozulub", "The chain is broken")}
                </div>
                <div className="text-13 text-ink-2">
                  {result.sealed} {L("qeyd yoxlanıldı", "entries checked")} · {formatDateTime(result.checked_at)}
                  {!result.valid && result.first_broken_seq != null && ` · ${L("ilk pozulan qeyd", "first broken entry")} №${result.first_broken_seq}`}
                  {result.missing_entries && ` · ${L("silinmiş qeyd var", "entries were deleted")}`}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-2">{L("Zəncirin bütövlüyünü yoxlayın: hər heş yenidən hesablanır.", "Verify the chain: every hash is recomputed.")}</div>
          )}
          <Button variant="secondary" onClick={() => verify.mutate()} disabled={verify.isPending}>
            <ShieldCheck /> {verify.isPending ? L("Yoxlanılır…", "Checking…") : L("Zənciri yoxla", "Verify the chain")}
          </Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("Son qeydlər", "Latest entries")}</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[960px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">{L("Vaxt", "Time")}</th>
                <th className="px-3 py-2 font-medium">{L("İcraçı", "Actor")}</th>
                <th className="px-3 py-2 font-medium">{L("Hərəkət", "Action")}</th>
                <th className="px-3 py-2 font-medium">{L("Obyekt", "Object")}</th>
                <th className="px-3 py-2 font-medium">{L("Ətraflı", "Details")}</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">{L("Zəncir", "Chain")}</th>
              </tr>
            </thead>
            <tbody className="tabular [&_td]:whitespace-nowrap">
              {!data && (
                <tr>
                  <td colSpan={7} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              )}
              {data?.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-ink-2">{formatDateTime(e.created_at)}</td>
                  <td className="px-3 py-2">
                    {e.actor_name ?? L("Sistem", "System")}
                    {e.actor_role && <span className="ml-1 text-2xs text-ink-3">{e.actor_role}</span>}
                  </td>
                  <td className={cn("px-3 py-2", e.action === "access.denied" && "text-status-rejected-fg")}>
                    {ACTION[e.action] ? L(ACTION[e.action], ACTION_EN[e.action] ?? ACTION[e.action]) : e.action}
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-2">
                    {e.entity_type}
                    {e.entity_id ? ` · ${e.entity_id.slice(0, 28)}` : ""}
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-2 text-ink-2" title={JSON.stringify(e.details)}>
                    {Object.entries(e.details)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                      .join(" · ")}
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-3">{e.ip ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-ink-3" title={e.hash ?? L("hələ möhürlənməyib", "not sealed yet")}>
                    {e.chain_seq != null ? `№${e.chain_seq} · ${e.hash?.slice(0, 8)}` : L("gözləyir", "pending")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export default function AuditPage() {
  return (
    <RequireRole roles={["SUPERVISOR", "STAFF", "ADMIN"]}>
      <AuditView />
    </RequireRole>
  );
}
