"use client";

import { CircleCheck, Download, FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError, type Schemas } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn, formatDateTime } from "@/lib/utils";

type Doc = Schemas["DocumentOut"];

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** One required document: what it is, whether it is attached, and upload/replace/remove. */
export function DocumentSlot({
  name,
  description,
  mandatory,
  maxMb,
  document,
  downloadHref,
  editable,
  highlight,
  onUpload,
  onRemove,
  busy
}: {
  name: string;
  description?: string | null;
  mandatory: boolean;
  maxMb: number;
  document?: Doc | null;
  downloadHref?: string;
  editable: boolean;
  highlight?: boolean;
  onUpload?: (file: File) => Promise<unknown>;
  onRemove?: () => Promise<unknown>;
  busy?: boolean;
}) {
  const L = useL();
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !onUpload) return;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(L(`Faylın ölçüsü ${maxMb} MB-dan çox olmamalıdır`, `The file must not exceed ${maxMb} MB`));
      return;
    }
    try {
      await onUpload(file);
      toast.success(L("Sənəd əlavə edildi", "Document added"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : L("Fayl yüklənmədi", "Upload failed"));
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        highlight && "bg-status-info-bg/60"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-ink">
          {document ? (
            <CircleCheck className="size-4 shrink-0 text-status-won-fg" aria-label={L("Əlavə edilib", "Attached")} />
          ) : (
            <span className="size-4 shrink-0 rounded-full border-2 border-border-strong" aria-hidden />
          )}
          {name}
          {!mandatory && <span className="font-normal text-ink-3">({L("könüllü", "optional")})</span>}
        </div>
        {document ? (
          <div className="ml-6 mt-0.5 text-13 text-ink-2">
            {downloadHref ? (
              <a href={downloadHref} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Download className="size-3.5" aria-hidden />
                {document.original_name}
              </a>
            ) : (
              document.original_name
            )}{" "}
            · {formatSize(document.size_bytes)} · {formatDateTime(document.uploaded_at)}
            {document.version > 1 && ` · versiya ${document.version}`}
          </div>
        ) : (
          description && <div className="ml-6 mt-0.5 text-13 text-ink-3">{description}</div>
        )}
      </div>
      {editable && (
        <div className="ml-6 flex shrink-0 gap-2 sm:ml-0">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <FileUp />}
            {document ? L("Əvəz et", "Replace") : L("Yüklə", "Upload")}
          </Button>
          {document && onRemove && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => onRemove()} aria-label={L("Sil", "Remove")}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
