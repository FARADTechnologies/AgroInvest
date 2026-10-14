"use client";

import type { ApplicationStatus } from "@/features/applications/api";
import type { Schemas } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { cn, formatDateTime } from "@/lib/utils";

type HistoryItem = Schemas["HistoryOut"];

const DOT: Record<string, string> = {
  DRAFT: "bg-status-draft-fg",
  RECEIVED: "bg-status-received-fg",
  UNDER_REVIEW: "bg-status-review-fg",
  INFO_REQUESTED: "bg-status-info-fg",
  WON: "bg-status-won-fg",
  REJECTED: "bg-status-rejected-fg"
};

/** Application history (R4.3): every status change with who, when and why. */
export function StatusTimeline({ items, className }: { items: HistoryItem[]; className?: string }) {
  const t = useT();
  const ordered = [...items].reverse();
  return (
    <ol className={cn("relative space-y-5", className)}>
      {ordered.map((h, i) => {
        const key = h.to_status === "DECIDED" && h.outcome ? h.outcome : h.to_status;
        const label =
          h.to_status === "DECIDED" && h.outcome
            ? `${t.status.DECIDED} · ${t.outcome[h.outcome]}`
            : t.status[h.to_status as ApplicationStatus];
        return (
          <li key={i} className="relative pl-6">
            {i < ordered.length - 1 && (
              <span className="absolute left-[5px] top-4 h-[calc(100%+8px)] w-px bg-border" aria-hidden />
            )}
            <span className={cn("absolute left-0 top-1.5 size-[11px] rounded-full ring-4 ring-surface", DOT[key])} aria-hidden />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium text-ink">{label}</span>
              <time className="tabular text-13 text-ink-3">{formatDateTime(h.created_at)}</time>
            </div>
            <div className="text-13 text-ink-3">{h.actor_label}</div>
            {h.reason && <p className="mt-1 text-sm text-ink-2">{h.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
