"use client";

import { Clock } from "lucide-react";

import { useL } from "@/lib/i18n";
import { cn, daysUntil, formatDate } from "@/lib/utils";

/** "12 gün qalıb", amber in the last week, muted once the deadline has passed. */
export function DeadlineBadge({ iso, className }: { iso: string; className?: string }) {
  const L = useL();
  const days = daysUntil(iso);
  const passed = days <= 0;
  const soon = !passed && days <= 7;
  return (
    <span
      title={`${L("Son müraciət tarixi", "Application deadline")}: ${formatDate(iso)}`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-13",
        passed ? "text-ink-3" : soon ? "font-medium text-status-info-fg" : "text-ink-2",
        className
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {passed ? L("Müddət bitib", "Closed") : L(`${days} gün qalıb`, `${days} days left`)}
    </span>
  );
}
