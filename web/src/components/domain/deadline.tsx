import { Clock } from "lucide-react";

import { cn, daysUntil, formatDate } from "@/lib/utils";

/** "12 gün qalıb", amber in the last week, muted once the deadline has passed. */
export function DeadlineBadge({ iso, className }: { iso: string; className?: string }) {
  const days = daysUntil(iso);
  const passed = days <= 0;
  const soon = !passed && days <= 7;
  return (
    <span
      title={`Son müraciət tarixi: ${formatDate(iso)}`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-13",
        passed ? "text-ink-3" : soon ? "font-medium text-status-info-fg" : "text-ink-2",
        className
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {passed ? "Müddət bitib" : `${days} gün qalıb`}
    </span>
  );
}
