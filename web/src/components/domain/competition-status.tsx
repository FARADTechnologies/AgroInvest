import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  DRAFT: "Qaralama",
  PENDING_APPROVAL: "Təsdiq gözləyir",
  PUBLISHED: "Dərc edilib",
  CLOSED: "Qəbul başa çatıb",
  RESULTS_ANNOUNCED: "Nəticələr elan edilib",
  CANCELLED: "Ləğv edilib"
};

const TONE: Record<string, string> = {
  DRAFT: "bg-status-draft-bg text-status-draft-fg",
  PENDING_APPROVAL: "bg-status-info-bg text-status-info-fg",
  PUBLISHED: "bg-status-won-bg text-status-won-fg",
  CLOSED: "bg-status-received-bg text-status-received-fg",
  RESULTS_ANNOUNCED: "bg-status-review-bg text-status-review-fg",
  CANCELLED: "bg-status-rejected-bg text-status-rejected-fg"
};

export const COMPETITION_STATUS_LABEL = LABEL;

/** A published competition whose deadline has passed reads as "Qəbul başa çatıb". */
export function CompetitionStatusBadge({ status, isOpen, className }: { status: string; isOpen?: boolean; className?: string }) {
  const key = status === "PUBLISHED" && isOpen === false ? "CLOSED" : status;
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-sm px-2 py-0.5 text-13 font-medium", TONE[key], className)}>
      {LABEL[key]}
    </span>
  );
}
