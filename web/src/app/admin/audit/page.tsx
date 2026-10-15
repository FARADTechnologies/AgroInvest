"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldX } from "lucide-react";

import { RequireRole } from "@/components/layout/require-role";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { api, unwrap } from "@/lib/api/client";
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
  "access.denied": "İcazəsiz cəhd"
};

function useAudit() {
  return useQuery({
    queryKey: ["audit"],
    queryFn: () => unwrap(api.GET("/api/v1/admin/audit", { params: { query: { limit: 200 } } })),
    refetchInterval: 10_000
  });
}

function AuditView() {
  const { data } = useAudit();
  const verify = useMutation({ mutationFn: () => unwrap(api.GET("/api/v1/admin/audit/verify")) });
  const result = verify.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl">Audit jurnalı</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Mütəxəssislərin hərəkətləri və fərdi məlumatlara hər müraciət. Jurnal yalnız əlavə olunur: qeydlər dəyişdirilə və
          silinə bilməz, hər qeyd SHA-256 heş zəncirinə bağlanır. Zəncirin yoxlanışı istənilən dəyişikliyi və ya silinməni
          aşkar edir.
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
                  {result.valid ? "Zəncir bütövdür" : "Zəncir pozulub"}
                </div>
                <div className="text-13 text-ink-2">
                  {result.sealed} qeyd yoxlanıldı · {formatDateTime(result.checked_at)}
                  {!result.valid && result.first_broken_seq != null && ` · ilk pozulan qeyd №${result.first_broken_seq}`}
                  {result.missing_entries && " · silinmiş qeyd var"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-2">Zəncirin bütövlüyünü yoxlayın: hər heş yenidən hesablanır.</div>
          )}
          <Button variant="secondary" onClick={() => verify.mutate()} disabled={verify.isPending}>
            <ShieldCheck /> {verify.isPending ? "Yoxlanılır…" : "Zənciri yoxla"}
          </Button>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Son qeydlər</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[960px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">Vaxt</th>
                <th className="px-3 py-2 font-medium">İcraçı</th>
                <th className="px-3 py-2 font-medium">Hərəkət</th>
                <th className="px-3 py-2 font-medium">Obyekt</th>
                <th className="px-3 py-2 font-medium">Ətraflı</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Zəncir</th>
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
                    {e.actor_name ?? "Sistem"}
                    {e.actor_role && <span className="ml-1 text-2xs text-ink-3">{e.actor_role}</span>}
                  </td>
                  <td className={cn("px-3 py-2", e.action === "access.denied" && "text-status-rejected-fg")}>
                    {ACTION[e.action] ?? e.action}
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
                  <td className="px-3 py-2 font-mono text-ink-3" title={e.hash ?? "hələ möhürlənməyib"}>
                    {e.chain_seq != null ? `№${e.chain_seq} · ${e.hash?.slice(0, 8)}` : "gözləyir"}
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
    <RequireRole roles={["SUPERVISOR", "ADMIN"]}>
      <AuditView />
    </RequireRole>
  );
}
