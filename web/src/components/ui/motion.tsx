"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn, formatNumber } from "@/lib/utils";

/** The one easing curve used across the app: quick start, soft landing. */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }
};

export const stagger = (step = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } }
});

/** Fades and lifts its children in once, when first rendered. */
export function FadeIn({
  children,
  delay = 0,
  y = 14,
  className,
  as = "div"
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "header" | "li";
}) {
  const Comp = motion[as];
  return (
    <Comp
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/** Container that reveals its <StaggerItem> children one after another. */
export function Stagger({
  children,
  className,
  step = 0.06,
  delay = 0,
  inView = false,
  as = "div"
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
  delay?: number;
  /** Start when scrolled into view instead of on mount. */
  inView?: boolean;
  as?: "div" | "ul" | "ol" | "section";
}) {
  const Comp = motion[as];
  return (
    <Comp
      variants={stagger(step, delay)}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-60px" } } : { animate: "show" })}
      className={className}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div"
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const Comp = motion[as];
  return (
    <Comp variants={fadeUp} className={className}>
      {children}
    </Comp>
  );
}

/** Counts up to `value` when it scrolls into view; formatted with Azerbaijani grouping. */
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1.2,
  className,
  suffix
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [text, setText] = useState(formatNumber(0, decimals));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setText(formatNumber(value, decimals));
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE, onUpdate: (v) => setText(formatNumber(v, decimals)) });
    return () => controls.stop();
  }, [inView, value, decimals, duration, mv, reduce]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {text}
      {suffix}
    </span>
  );
}

/** Horizontal bar that grows to `pct` when visible. */
export function GrowBar({ pct, className, barClassName, delay = 0 }: { pct: number; className?: string; barClassName?: string; delay?: number }) {
  return (
    <span className={cn("block h-2 overflow-hidden rounded-full bg-surface-2", className)}>
      <motion.span
        className={cn("block h-full rounded-full bg-primary", barClassName)}
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      />
    </span>
  );
}
