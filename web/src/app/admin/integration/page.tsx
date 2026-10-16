"use client";

import { ArrowDownLeft, ArrowUpRight, CircleAlert, CircleCheck, CircleX, Clock, PlugZap, RotateCcw, Unplug } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader, PanelTitle, Skeleton } from "@/components/ui/panel";
import { useSession, can } from "@/features/auth/use-session";
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
import { useL } from "@/lib/i18n";
import { cn, formatDateTime, formatTime } from "@/lib/utils";

const OPERATION: Record<string, [string, string]> = {
  "decision.send": ["Qərarın ötürülməsi", "Decision sent"],
  "decision.registered": ["EKTİS təsdiqi (geri çağırış)", "EKTİS confirmation (callback)"],
  "farmer.lookup": ["Fermer sorğusu", "Farmer lookup"],
  "mock.fault": ["Nasazlıq simulyasiyası", "Fault simulation"]
};

const OUTBOX: Record<OutboxMessage["status"], { label: [string, string]; icon: typeof Clock; className: string }> = {
  PENDING: { label: ["Növbədə", "Queued"], icon: Clock, className: "bg-status-info-bg text-status-info-fg" },
  SENT: { label: ["Çatdırılıb", "Delivered"], icon: CircleCheck, className: "bg-status-won-bg text-status-won-fg" },
  FAILED: { label: ["Uğursuz", "Failed"], icon: CircleX, className: "bg-status-rejected-bg text-status-rejected-fg" }
};

function OutboxBadge({ status }: { status: OutboxMessage["status"] }) {
  const L = useL();
  const { label, icon: Icon, className } = OUTBOX[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-13 font-medium", className)}>
      <Icon className="size-3.5" aria-hidden />
      {L(label[0], label[1])}
    </span>
  );
}

function Connection({ status }: { status: IntegrationStatus }) {
  const L = useL();
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
            ? L("əlçatan deyil (simulyasiya)", "unavailable (simulated)")
            : status.reachable
              ? L("əlçatandır", "reachable")
              : status.mode === "disabled"
                ? L("inteqrasiya söndürülüb", "integration switched off")
                : L("cavab vermir", "not answering")}
        </div>
        <div className="text-13 text-ink-2">
          {L("Növbədə", "Queued")} <span className="tabular font-medium text-ink">{status.pending}</span> · {L("Çatdırılıb", "Delivered")}{" "}
          <span className="tabular font-medium text-ink">{status.sent}</span> · {L("Uğursuz", "Failed")}{" "}
          <span className="tabular font-medium text-ink">{status.failed}</span>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationPage() {
  const L = useL();
  const { data: user } = useSession();
  const canControl = can(user, "INTEGRATION_MANAGE");
  const { data: status } = useIntegrationStatus();
  const { data: outbox } = useOutbox();
  const { data: log } = useIntegrationLog();
  const fault = useSetFault();
  const resend = useResend();

  const toggle = (mode: "NONE" | "DOWN") =>
    fault.mutate(mode, {
      onSuccess: () =>
        toast.success(
          mode === "DOWN"
            ? L("EKTİS nasazlığı simulyasiya olunur", "Simulating an EKTİS outage")
            : L("EKTİS bərpa olundu; növbə emal olunur", "EKTİS restored; the queue is being processed")
        ),
      onError: (e) => toast.error(e instanceof ApiError ? e.message : L("Xəta baş verdi", "Something went wrong"))
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl">{L("İnteqrasiya logu", "Integration log")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {L(
            "EKTİS ilə məlumat mübadiləsi. Qalib qərarı verilən anda eyni tranzaksiyada növbəyə yazılır və arxa planda göndərilir; EKTİS cavab verməsə, avtomatik olaraq yenidən cəhd edilir. EKTİS qeydiyyatı imzalı geri çağırışla (HMAC) təsdiqləyir. Hər çağırış izləmə identifikatoru (X-Request-ID) ilə qeydə alınır, FİN/VÖEN maskalanır.",
            "Data exchange with EKTİS. A winning decision is queued in the same transaction and sent in the background; if EKTİS does not answer, it is retried automatically. EKTİS confirms the registration with a signed callback (HMAC). Every call is logged with a trace ID (X-Request-ID); FİN/VÖEN are masked."
          )}
        </p>
      </div>

      <Panel>
        <PanelBody className="flex flex-wrap items-center justify-between gap-4">
          {status ? <Connection status={status} /> : <Skeleton className="h-10 w-72" />}
          {canControl && status?.mode === "mock" && (
            <div className="flex flex-col items-end gap-1">
              {status.fault === "DOWN" ? (
                <Button onClick={() => toggle("NONE")} disabled={fault.isPending}>
                  <PlugZap /> {L("EKTİS-i bərpa et", "Restore EKTİS")}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => toggle("DOWN")} disabled={fault.isPending}>
                  <Unplug /> {L("Nasazlığı simulyasiya et", "Simulate an outage")}
                </Button>
              )}
              <span className="text-2xs text-ink-3">{L("Yalnız mock rejimində; real EKTİS-ə qoşulmur", "Mock mode only; the real EKTİS is never contacted")}</span>
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("EKTİS-ə göndərilən qərarlar", "Decisions sent to EKTİS")}</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[900px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">{L("Müraciət", "Application")}</th>
                <th className="px-3 py-2 font-medium">{L("Sahə", "Plot")}</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">{L("Cəhd", "Attempts")}</th>
                <th className="px-3 py-2 font-medium">{L("Növbəti cəhd", "Next attempt")}</th>
                <th className="px-3 py-2 font-medium">{L("EKTİS istinadı", "EKTİS reference")}</th>
                <th className="px-3 py-2 font-medium">{L("EKTİS təsdiqi", "EKTİS confirmation")}</th>
                <th className="px-3 py-2 font-medium">{L("Son xəta", "Last error")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="tabular [&_td]:whitespace-nowrap">
              {!outbox && (
                <tr>
                  <td colSpan={9} className="px-3 py-2">
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
                  <td className="px-3 py-2">
                    {m.confirmed_at ? (
                      <span className="text-status-won-fg" title={`${L("Təsdiq", "Confirmed")}: ${formatDateTime(m.confirmed_at)}`}>
                        <span className="font-mono">{m.land_use_right_id}</span> · {formatTime(m.confirmed_at)}
                      </span>
                    ) : m.status === "SENT" ? (
                      <span className="text-ink-3">{L("gözlənilir", "awaited")}</span>
                    ) : (
                      "—"
                    )}
                  </td>
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
                                ? toast.success(`${r.application_number} ${L("EKTİS-ə çatdırıldı", "delivered to EKTİS")}`)
                                : toast.error(L("EKTİS cavab vermədi; avtomatik cəhdlər davam edir", "EKTİS did not answer; automatic retries continue")),
                            onError: (e) => toast.error(e instanceof ApiError ? e.message : L("Xəta baş verdi", "Something went wrong"))
                          })
                        }
                      >
                        <RotateCcw /> {L("İndi göndər", "Send now")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {outbox && outbox.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-ink-2">
                    {L(
                      "Hələ göndəriləcək qərar yoxdur. Müraciət üzrə “Qalib” qərarı verildikdə burada görünəcək.",
                      "No decisions to send yet. They appear here when an application is decided as the winner."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>{L("Çağırışlar", "Calls")}</PanelTitle>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="condensed w-full min-w-[980px] text-13">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-ink-2">
                <th className="px-3 py-2 font-medium">{L("Vaxt", "Time")}</th>
                <th className="px-3 py-2 font-medium">{L("Əməliyyat", "Operation")}</th>
                <th className="px-3 py-2 font-medium">{L("Sorğu", "Request")}</th>
                <th className="px-3 py-2 font-medium">{L("Nəticə", "Result")}</th>
                <th className="px-3 py-2 text-right font-medium">{L("Müddət", "Duration")}</th>
                <th className="px-3 py-2 font-medium">X-Request-ID</th>
                <th className="px-3 py-2 font-medium">{L("Təsvir", "Description")}</th>
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
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5" title={e.direction === "IN" ? "EKTİS → portal" : "Portal → EKTİS"}>
                      {e.direction === "IN" ? (
                        <ArrowDownLeft className="size-3.5 text-ink-3" aria-label={L("daxil olan", "incoming")} />
                      ) : (
                        <ArrowUpRight className="size-3.5 text-ink-3" aria-label={L("çıxan", "outgoing")} />
                      )}
                      {OPERATION[e.operation] ? L(OPERATION[e.operation][0], OPERATION[e.operation][1]) : e.operation}
                    </span>
                  </td>
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
                      {e.status_code ?? L("əlaqə yoxdur", "no connection")}
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
                    {L("Hələ çağırış qeydə alınmayıb.", "No calls logged yet.")}
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
