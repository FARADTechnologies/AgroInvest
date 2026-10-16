"use client";

import { ArrowRight, Check, GitCompareArrows, Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { COMPARE_LIMIT, useCompare } from "./compare-store";

/** "Müqayisəyə əlavə et" toggle for one area. */
export function CompareButton({
  code,
  size = "sm",
  iconOnly = false,
  short = false,
  className
}: {
  code: string;
  size?: "sm" | "md";
  /** Square icon button with the label as a tooltip, for tight action rows. */
  iconOnly?: boolean;
  /** One-word label ("Müqayisə") for narrow cards. */
  short?: boolean;
  className?: string;
}) {
  const L = useL();
  const { has, add, remove, full } = useCompare();
  const selected = has(code);
  const label = selected
    ? L("Müqayisədədir", "In comparison")
    : short
      ? L("Müqayisə", "Compare")
      : L("Müqayisəyə əlavə et", "Add to compare");
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      aria-pressed={selected}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      className={cn(iconOnly && "w-8 shrink-0 px-0", selected && "border-primary/40 bg-primary-50 text-primary", className)}
      onClick={() => {
        if (selected) return remove(code);
        if (full) return toast.error(L(`Ən çox ${COMPARE_LIMIT} sahə müqayisə edilə bilər`, `You can compare up to ${COMPARE_LIMIT} plots`));
        add(code);
        toast.success(L(`${code} müqayisəyə əlavə edildi`, `${code} added to comparison`));
      }}
    >
      {selected ? <Check /> : <Plus />}
      {!iconOnly && label}
    </Button>
  );
}

/** Bar listing the areas picked for comparison, with a link to the comparison page. */
export function CompareTray({ className }: { className?: string }) {
  const L = useL();
  const { codes, remove, clear } = useCompare();
  return (
    <AnimatePresence>
      {codes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.4, ease: EASE }}
          className={cn("glass-dark flex flex-wrap items-center gap-2 rounded-full py-2 pl-4 pr-2 text-13", className)}
          aria-label={L("Müqayisə siyahısı", "Comparison list")}
        >
          <GitCompareArrows className="size-4 text-accent" aria-hidden />
          <span className="font-semibold">
            {L("Müqayisə", "Compare")} <span className="tabular text-white/50">{codes.length}/{COMPARE_LIMIT}</span>
          </span>
          <AnimatePresence initial={false}>
            {codes.map((c) => (
              <motion.span
                key={c}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2.5 pr-1 font-mono text-2xs"
              >
                {c}
                <button type="button" onClick={() => remove(c)} aria-label={L(`${c} siyahıdan çıxar`, `Remove ${c}`)} className="rounded-full p-0.5 text-white/60 hover:bg-white/10 hover:text-white">
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <button type="button" onClick={clear} className="px-1 text-white/60 hover:text-white hover:underline">
            {L("Təmizlə", "Clear")}
          </button>
          {codes.length < 2 ? (
            <span className="ml-auto pr-2 text-white/60">{L("Ən azı 2 sahə seçin", "Pick at least 2 plots")}</span>
          ) : (
            <Button asChild variant="lime" size="sm" className="ml-auto">
              <Link href={`/compare?codes=${codes.join(",")}`}>
                {L("Müqayisə et", "Compare")} <ArrowRight />
              </Link>
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
