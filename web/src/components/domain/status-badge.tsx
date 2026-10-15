"use client";

import { BadgeCheck, CircleAlert, CircleX, FilePen, Gavel, Inbox, ScanSearch } from "lucide-react";

import type { ApplicationStatus, Outcome } from "@/lib/domain";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STYLE: Record<string, { icon: typeof Inbox; className: string }> = {
  DRAFT: { icon: FilePen, className: "bg-status-draft-bg text-status-draft-fg" },
  RECEIVED: { icon: Inbox, className: "bg-status-received-bg text-status-received-fg" },
  UNDER_REVIEW: { icon: ScanSearch, className: "bg-status-review-bg text-status-review-fg" },
  INFO_REQUESTED: { icon: CircleAlert, className: "bg-status-info-bg text-status-info-fg" },
  // Used where only the status is known (e.g. aggregate counts), not the outcome.
  DECIDED: { icon: Gavel, className: "bg-surface-2 text-ink-2" },
  WON: { icon: BadgeCheck, className: "bg-status-won-bg text-status-won-fg" },
  REJECTED: { icon: CircleX, className: "bg-status-rejected-bg text-status-rejected-fg" }
};

/**
 * The one status badge used on every screen. A decided application shows its
 * outcome ("Qərar verilib · Qalib") so the colour always carries the result.
 */
export function StatusBadge({
  status,
  outcome,
  className
}: {
  status: ApplicationStatus;
  outcome?: Outcome | null;
  className?: string;
}) {
  const t = useT();
  const key = status === "DECIDED" && outcome ? outcome : status;
  const { icon: Icon, className: tone } = STYLE[key] ?? STYLE.DRAFT;
  const label =
    status === "DECIDED" && outcome ? `${t.status.DECIDED} · ${t.outcome[outcome]}` : t.status[status];
  return (
    <span
      title={t.statusHint[status]}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-13 font-medium",
        tone,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
