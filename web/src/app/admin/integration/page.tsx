"use client";

import { CircleAlert, CircleCheck, CircleX, Clock, PlugZap, RotateCcw, Unplug } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useSession } from "@/features/auth/use-session";
import {
  type IntegrationStatus,
  type OutboxMessage,
  useIntegrationLog,
  useIntegrationStatus,
  useOutbox,
  useResend,
  useSetFault
} from "@/features/integration/api";
import { ApiError } from "@/lib/api/client";
import { cn, formatDateTime, formatTime } from "@/lib/utils";

const OPERATION: Record<string, string> = {
  "decision.send": "Qərarın ötürülməsi",
  "farmer.lookup": "Fermer sorğusu",
  "mock.fault": "Nasazlıq simulyasiyası"
};

const OUTBOX: Record<OutboxMessage["status"], { label: string; icon: typeof Clock; className: string }> = {
  PENDING: { label: "Növbədə", icon: Clock, className: "bg-status-info-bg text-status-info-fg" },
  SENT: { label: "Çatdırılıb", icon: CircleCheck, className: "bg-status-won-bg text-status-won-fg" },
  FAILED: { label: "Uğursuz", icon: CircleX, className: "bg-status-rejected-bg text-status-rejected-fg" }
};

function OutboxBadge({ status }: { status: OutboxMessage["status"] }) {
  const { label, icon: Icon, className } = OUTBOX[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-13 font-medium", className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

function Connection({ status }: { status: IntegrationStatus }) {
  const down = status.fault === "DOWN" || !status.reachable;
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-md",
          down ? "bg-status-rejected-bg text-status-rejected-fg" : "bg-status-won-bg text-status-won-fg"
        )}
      >
        {down ? <Unplug className="size-5" aria-hidden /> : <PlugZap className="size-5" aria-hidden />}
      </span>
      <div>
        <div className="text-15 font-semibold">
          EKTİS {status.mode === "mock" ? "(mock)" : ""}:{" "}
          {status.fault === "DOWN"
            ? "əlçatan deyil (simulyasiya)"
            : status.reachable
              ? "əlçatandır"
              : status.mode === "disabled"
                ? "inteqrasiya söndürülüb"
                : "cavab vermir"}
        </div>
        <div className="text-13 text-ink-2">
          Növbədə <span className="tabular font-medium text-ink">{status.pending}</span> · Çatdırılıb{" "}
          <span className="tabular font-medium text-ink">{status.sent}</span> · Uğursuz{" "}
          <span className="tabular font-medium text-ink">{status.failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationPage() {
  const { data: user } = useSession();
  const canControl = user?.role === "SPECIALIST" || user?.role === "ADMIN";
  const { data: status } = useIntegrationStatus();
  const { data: outbox } = useOutbox();
  const { data: log } = useIntegrationLog();
  const fault = useSetFault();
  const resend = useResend();

  const toggle = (mode: "NONE" | "DOWN") =>
    fault.mutate(mode, {
      onSuccess: () =>
        toast.success(mode === "DOWN" ? "EKTİS nasazlığı simulyasiya olunur" : "EKTİS bərpa olundu; növbə emal olunur"),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : "Xəta baş verdi")
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl">İnteqrasiya logu</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          EKTİS ilə məlumat mübadiləsi. Qalib qərarı verilən anda eyni tranzaksiyada növbəyə yazılır və arxa planda
          göndərilir; EKTİS cavab verməsə, avtomatik olaraq yenidən cəhd edilir. Hər çağırış izləmə identifikatoru
          (X-Request-ID) ilə qeydə alınır, FİN/VÖEN maskalanır.
        </p>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-4">
          {status ? <Connection status={status} /> : <Skeleton className="h-10 w-72" />}
          {canControl && status?.mode === "mock" && (
            <div className="flex flex-col items-end gap-1">
              {status.fault === "DOWN" ? (
                <Button onClick={() => toggle("NONE")} disabled={fault.isPending}>
                  <PlugZap /> EKTİS-i bərpa et
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => toggle("DOWN")} disabled={fault.isPending}>
                  <Unplug /> Nasazlığı simulyasiya et
                </Button>
              )}
              <span className="text-2xs text-ink-3">Yalnız mock rejimində; real EKTİS-ə qoşulmur</span>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>EKTİS-ə göndərilən qərarlar</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[900px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">Müraciət</th>
                <th className="px-3 py-2 font-medium">Sahə</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Cəhd</th>
                <th className="px-3 py-2 font-medium">Növbəti cəhd</th>
                <th className="px-3 py-2 font-medium">EKTİS istinadı</th>
                <th className="px-3 py-2 font-medium">Son xəta</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="tabular [&_td]:whitespace-nowrap">
              {!outbox && (
                <tr>
                  <td colSpan={8} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              )}
              {outbox?.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    {m.application_id ? (
                      <Link href={`/admin/applications/${m.application_id}`} className="font-mono font-medium text-primary hover:underline">
                        {m.application_number}
                      </Link>
                    ) : (
                      <span className="font-mono">{m.application_number}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-2">{m.area_code}</td>
                  <td className="px-3 py-2">
                    <OutboxBadge status={m.status} />
                  </td>
                  <td className="px-3 py-2 text-right">{m.attempts}</td>
                  <td className="px-3 py-2 text-ink-2">{m.status === "PENDING" ? formatTime(m.next_attempt_at) : "—"}</td>
                  <td className="px-3 py-2 font-mono">{m.ektis_reference ?? "—"}</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-ink-2" title={m.last_error ?? undefined}>
                    {m.last_error ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canControl && m.status !== "SENT" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={resend.isPending}
                        onClick={() =>
                          resend.mutate(m.id, {
                            onSuccess: (r) =>
                              r.status === "SENT"
                                ? toast.success(`${r.application_number} EKTİS-ə çatdırıldı`)
                                : toast.error("EKTİS cavab vermədi; avtomatik cəhdlər davam edir"),
                            onError: (e) => toast.error(e instanceof ApiError ? e.message : "Xəta baş verdi")
                          })
                        }
                      >
                        <RotateCcw /> İndi göndər
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {outbox && outbox.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-ink-2">
                    Hələ göndəriləcək qərar yoxdur. Müraciət üzrə “Qalib” qərarı verildikdə burada görünəcək.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Çağırışlar</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[980px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">Vaxt</th>
                <th className="px-3 py-2 font-medium">Əməliyyat</th>
                <th className="px-3 py-2 font-medium">Sorğu</th>
                <th className="px-3 py-2 font-medium">Nəticə</th>
                <th className="px-3 py-2 text-right font-medium">Müddət</th>
                <th className="px-3 py-2 font-medium">X-Request-ID</th>
                <th className="px-3 py-2 font-medium">Təsvir</th>
              </tr>
            </thead>
            <tbody className="tabular [&_td]:whitespace-nowrap">
              {!log && (
                <tr>
                  <td colSpan={7} className="px-3 py-2">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              )}
              {log?.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-ink-2" title={formatDateTime(e.created_at)}>
                    {formatTime(e.created_at)}
                  </td>
                  <td className="px-3 py-2">{OPERATION[e.operation] ?? e.operation}</td>
                  <td className="px-3 py-2 font-mono text-ink-2">
                    {e.method} {e.path}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-medium",
                        e.ok ? "text-status-won-fg" : "text-status-rejected-fg"
                      )}
                    >
                      {e.ok ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
                      {e.status_code ?? "əlaqə yoxdur"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-2">{e.duration_ms} ms</td>
                  <td className="px-3 py-2 font-mono text-ink-3" title={e.request_id}>
                    {e.request_id.slice(0, 8)}
                  </td>
                  <td className="max-w-[360px] truncate px-3 py-2" title={e.error ?? e.summary ?? undefined}>
                    {e.summary}
                    {e.error && <span className="ml-1 text-ink-3">· {e.error}</span>}
                  </td>
                </tr>
              ))}
              {log && log.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-ink-2">
                    Hələ çağırış qeydə alınmayıb.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
