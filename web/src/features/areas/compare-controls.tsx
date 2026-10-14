"use client";

import { ArrowRight, Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { COMPARE_LIMIT, useCompare } from "./compare-store";

/** "Müqayisəyə əlavə et" toggle for one area. */
export function CompareButton({ code, size = "sm", className }: { code: string; size?: "sm" | "md"; className?: string }) {
  const { has, add, remove, full } = useCompare();
  const selected = has(code);
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      aria-pressed={selected}
      className={className}
      onClick={() => {
        if (selected) return remove(code);
        if (full) return toast.error(`Ən çox ${COMPARE_LIMIT} sahə müqayisə edilə bilər`);
        add(code);
      }}
    >
      {selected ? <Check /> : <Plus />}
      {selected ? "Müqayisədədir" : "Müqayisəyə əlavə et"}
    </Button>
  );
}

/** Bar listing the areas picked for comparison, with a link to the comparison page. */
export function CompareTray({ className }: { className?: string }) {
  const { codes, remove, clear } = useCompare();
  if (codes.length === 0) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-13 shadow-popover",
        className
      )}
      aria-label="Müqayisə siyahısı"
    >
      <span className="font-medium text-ink">
        Müqayisə <span className="tabular text-ink-3">{codes.length}/{COMPARE_LIMIT}</span>
      </span>
      {codes.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 font-mono">
          {c}
          <button type="button" onClick={() => remove(c)} aria-label={`${c} siyahıdan çıxar`} className="rounded text-ink-3 hover:text-ink">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button type="button" onClick={clear} className="text-ink-3 hover:text-ink hover:underline">
        Təmizlə
      </button>
      {codes.length < 2 ? (
        <span className="ml-auto text-ink-3">Ən azı 2 sahə seçin</span>
      ) : (
        <Button asChild size="sm" className="ml-auto">
          <Link href={`/compare?codes=${codes.join(",")}`}>
            Müqayisə et <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}
