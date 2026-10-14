import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  DRAFT: "Qaralama",
  PENDING_APPROVAL: "Təsdiq gözləyir",
  UPCOMING: "Qəbul hələ başlamayıb",
  PUBLISHED: "Qəbul davam edir",
  CLOSED: "Qəbul başa çatıb",
  RESULTS_ANNOUNCED: "Nəticələr elan edilib",
  CANCELLED: "Ləğv edilib"
};

const TONE: Record<string, string> = {
  DRAFT: "bg-status-draft-bg text-status-draft-fg",
  PENDING_APPROVAL: "bg-status-info-bg text-status-info-fg",
  UPCOMING: "bg-status-received-bg text-status-received-fg",
  PUBLISHED: "bg-status-won-bg text-status-won-fg",
  CLOSED: "bg-status-draft-bg text-status-draft-fg",
  RESULTS_ANNOUNCED: "bg-status-review-bg text-status-review-fg",
  CANCELLED: "bg-status-rejected-bg text-status-rejected-fg"
};

export const COMPETITION_STATUS_LABEL = LABEL;

/** What a published competition means right now: not yet open, open, or closed for applications. */
export function competitionPhase(status: string, opensAt?: string, deadlineAt?: string, now = new Date()): string {
  if (status !== "PUBLISHED" || !opensAt || !deadlineAt) return status;
  if (now < new Date(opensAt)) return "UPCOMING";
  if (now >= new Date(deadlineAt)) return "CLOSED";
  return "PUBLISHED";
}

export function CompetitionStatusBadge({
  status,
  opensAt,
  deadlineAt,
  className
}: {
  status: string;
  opensAt?: string;
  deadlineAt?: string;
  className?: string;
}) {
  const key = competitionPhase(status, opensAt, deadlineAt);
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-sm px-2 py-0.5 text-13 font-medium", TONE[key], className)}>
      {LABEL[key]}
    </span>
  );
}
