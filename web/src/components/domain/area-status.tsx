import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const AREA_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Qaralama",
  AVAILABLE: "Müsabiqəyə hazırdır",
  IN_COMPETITION: "Müsabiqədə",
  ALLOCATED: "Bölüşdürülüb",
  WITHDRAWN: "Geri çəkilib"
};

export const AREA_STATUS_LABEL_EN: Record<string, string> = {
  DRAFT: "Draft",
  AVAILABLE: "Ready for competition",
  IN_COMPETITION: "In competition",
  ALLOCATED: "Allocated",
  WITHDRAWN: "Withdrawn"
};

/** Area status label in the interface language. */
export function useAreaStatusLabel() {
  const { lang } = useLang();
  return (status: string) => (lang === "en" ? AREA_STATUS_LABEL_EN : AREA_STATUS_LABEL)[status] ?? status;
}

const AREA_TONE: Record<string, string> = {
  DRAFT: "bg-status-draft-bg text-status-draft-fg",
  AVAILABLE: "bg-status-received-bg text-status-received-fg",
  IN_COMPETITION: "bg-status-review-bg text-status-review-fg",
  ALLOCATED: "bg-status-won-bg text-status-won-fg",
  WITHDRAWN: "bg-status-rejected-bg text-status-rejected-fg"
};

export function AreaStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = useAreaStatusLabel();
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-13 font-medium", AREA_TONE[status], className)}>
      {label(status)}
    </span>
  );
}

export const DEMINING_LABEL: Record<string, string> = {
  CLEARED: "Minalardan təmizlənib",
  IN_PROGRESS: "Minatəmizləmə davam edir",
  NOT_SURVEYED: "Tədqiq edilməyib"
};

/** Demining state with an icon, never colour alone. */
const DEMINING_LABEL_EN: Record<string, string> = {
  CLEARED: "Cleared of mines",
  IN_PROGRESS: "Demining in progress",
  NOT_SURVEYED: "Not surveyed"
};

export function DeminingBadge({ status }: { status: string }) {
  const { lang } = useLang();
  const Icon = status === "CLEARED" ? ShieldCheck : status === "IN_PROGRESS" ? ShieldAlert : ShieldQuestion;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-13",
        status === "CLEARED" ? "text-status-won-fg" : "text-status-info-fg"
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {(lang === "en" ? DEMINING_LABEL_EN : DEMINING_LABEL)[status] ?? status}
    </span>
  );
}
