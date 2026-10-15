"use client";

import { ArrowLeft, FileCheck2, MapPinned, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

import { Brand, BrandMark } from "@/components/layout/brand";
import { EASE, Stagger, StaggerItem } from "@/components/ui/motion";
import { Accent } from "@/components/ui/page-header";
import { useL } from "@/lib/i18n";
import { AUTH_FIELDS, SATELLITE_ATTRIBUTION } from "@/lib/imagery";

const POINTS = [
  { icon: MapPinned, text: "Sahələri peyk xəritəsində seçin və müqayisə edin", en: "Find and compare plots on a satellite map" },
  { icon: FileCheck2, text: "Biznes planı və sənədləri onlayn təqdim edin", en: "Submit your business plan and documents online" },
  { icon: ShieldCheck, text: "Hər mərhələni və qərarı kabinetdə izləyin", en: "Follow every step and decision in your account" }
];

/** Two cards side by side: imagery with what the portal offers, and the form. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const L = useL();
  return (
    <div className="min-h-screen bg-bg p-2 sm:p-3">
      <div className="grid min-h-[calc(100vh-16px)] gap-2 sm:min-h-[calc(100vh-24px)] sm:gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative hidden overflow-hidden rounded-[28px] bg-[radial-gradient(120%_80%_at_50%_0%,#3E6B3C_0%,#13432F_55%,#0A2418_100%)] lg:block"
        >
          <img
            src={AUTH_FIELDS}
            alt=""
            className="animate-kenburns absolute inset-0 size-full object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          {/* Warm morning light from the top, deep green at the bottom. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_214_140/0.55)_0%,rgb(255_200_120/0.15)_35%,rgb(10_36_24/0.2)_60%,rgb(10_36_24/0.92)_100%)]" aria-hidden />
          <div className="relative flex h-full flex-col items-center px-10 pb-10 pt-16 text-center">
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.3 }}
            >
              <BrandMark className="size-14 shadow-float" />
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
              className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink"
            >
              {L("Torpağı gücləndiririk,", "Strengthening the land,")}
              <br />
              <Accent className="text-primary">{L("sahibkarı", "connecting")}</Accent> {L("bağlayırıq", "investors")}
            </motion.h2>
            <Stagger delay={0.7} step={0.12} className="mt-auto w-full max-w-sm space-y-2.5 text-left">
              {POINTS.map(({ icon: Icon, text, en }) => (
                <StaggerItem key={text} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white backdrop-blur-md">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-ink">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  {L(text, en)}
                </StaggerItem>
              ))}
            </Stagger>
            <span className="mt-4 text-[10px] text-white/45">{SATELLITE_ATTRIBUTION}</span>
          </div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="flex flex-col rounded-[28px] border border-border/70 bg-surface px-6 py-6 shadow-card sm:px-10"
        >
          <div className="flex items-center justify-between">
            <Brand />
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-13 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> {L("Ana səhifə", "Home")}
            </Link>
          </div>
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-13 text-ink-3">
            <span>© 2026 {L("Aqrar İnvestisiya Portalı · Prototip", "Agricultural Investment Portal · Prototype")}</span>
            <Link href="/privacy" className="hover:text-ink">{L("Məxfilik siyasəti", "Privacy policy")}</Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
