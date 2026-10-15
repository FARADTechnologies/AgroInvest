"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import { EASE } from "./motion";

/** Page title block: small eyebrow, large title, a line of context and actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("flex flex-wrap items-end justify-between gap-4", className)}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-2xs font-semibold uppercase tracking-[0.14em] text-ink-2 shadow-card">
            <span className="size-1.5 rounded-full bg-accent-strong" aria-hidden />
            {eyebrow}
          </div>
        )}
        <h1 className="text-balance text-[28px] leading-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

/**
 * Accent word inside a headline: same typeface as the headline (IBM Plex Sans
 * covers every Azerbaijani letter), set apart by colour and a drawn underline.
 */
export function Accent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-block whitespace-nowrap", className)}>
      {children}
      <svg
        className="pointer-events-none absolute -bottom-[0.12em] left-0 h-[0.22em] w-full overflow-visible opacity-50"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        aria-hidden
      >
        <motion.path
          d="M2 7 C 25 2, 50 2, 98 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
        />
      </svg>
    </span>
  );
}
