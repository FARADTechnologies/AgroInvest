"use client";

import {
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
  Wind
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { EASE } from "@/components/ui/motion";
import { type Lang, useL, useLang } from "@/lib/i18n";
import { cn, formatNumber } from "@/lib/utils";

import { useForecast } from "./api";

const WEEKDAY: Record<Lang, string[]> = {
  az: ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

/** WMO weather code → icon and Azerbaijani label. */
export function weatherMeta(code: number, lang: Lang = "az"): { icon: typeof Sun; label: string; tone: string } {
  const l = (az: string, en: string) => (lang === "en" ? en : az);
  if (code === 0) return { icon: Sun, label: l("Açıq", "Clear"), tone: "text-[#F2B01E]" };
  if (code <= 2) return { icon: CloudSun, label: l("Az buludlu", "Partly cloudy"), tone: "text-[#F2B01E]" };
  if (code === 3) return { icon: Cloud, label: l("Buludlu", "Cloudy"), tone: "text-ink-3" };
  if (code <= 48) return { icon: CloudFog, label: l("Duman", "Fog"), tone: "text-ink-3" };
  if (code <= 57) return { icon: CloudDrizzle, label: l("Çiskin", "Drizzle"), tone: "text-[#3B82C4]" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { icon: CloudRain, label: l("Yağış", "Rain"), tone: "text-[#3B82C4]" };
  if (code <= 77 || code === 85 || code === 86) return { icon: CloudSnow, label: l("Qar", "Snow"), tone: "text-[#6AA7D8]" };
  return { icon: CloudLightning, label: l("Tufan", "Storm"), tone: "text-[#7C5CC4]" };
}

/** Two thin lines (max and min) across the week, like a sparkline. */
function TempLines({ max, min }: { max: number[]; min: number[] }) {
  const all = [...max, ...min];
  const hi = Math.max(...all);
  const lo = Math.min(...all);
  const w = 280;
  const h = 64;
  const x = (i: number) => 20 + (i * (w - 40)) / Math.max(1, max.length - 1);
  const y = (v: number) => 12 + ((hi - v) / Math.max(1, hi - lo)) * (h - 24);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" aria-hidden>
      {[{ vals: max, color: "#E2553D" }, { vals: min, color: "#3B82C4" }].map(({ vals, color }) => (
        <g key={color}>
          <motion.path
            d={path(vals)}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          {vals.map((v, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={3} fill="#fff" stroke={color} strokeWidth={1.8} />
              <text x={x(i)} y={y(v) - 6} textAnchor="middle" className="fill-ink-2 text-[9px] font-semibold">
                {Math.round(v)}°
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Seven-day forecast for a plot (or the region centre) as a glass card over the map. */
export function ForecastCard({
  point,
  place,
  defaultOpen = true,
  className
}: {
  point: [number, number] | null;
  place?: string;
  /** Follows changes too: the map folds the card while a plot card is open. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const { data } = useForecast(point);
  const L = useL();
  const { lang } = useLang();
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  if (!data) return null;
  const now = weatherMeta(data.current.code, lang);
  const NowIcon = now.icon;
  const rainyDays = data.daily.filter((d) => d.rain >= 1).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={cn("glass w-[320px] overflow-hidden rounded-3xl", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className={cn("flex size-10 items-center justify-center rounded-2xl bg-white shadow-card", now.tone)}>
          <NowIcon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tabular">{formatNumber(data.current.temperature, 0)}°C</span>
            <span className="truncate text-13 text-ink-2">{now.label}</span>
          </span>
          <span className="block truncate text-2xs text-ink-3">{place ?? "Region"} · {L("7 günlük proqnoz", "7-day forecast")}</span>
        </span>
        <motion.span animate={{ rotate: open ? 0 : 180 }} className="text-ink-3">
          <ChevronDown className="size-4" aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 pb-2 text-13 text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Wind className="size-3.5" aria-hidden /> {formatNumber(data.current.wind, 1)} m/s
              </span>
              <span className="inline-flex items-center gap-1">
                <Droplets className="size-3.5" aria-hidden /> {data.current.humidity}%
              </span>
              {rainyDays > 0 && (
                <span className="ml-auto rounded-full bg-[#3B82C4]/10 px-2 py-0.5 text-2xs font-semibold text-[#2A6AA8]">
                  {rainyDays} {L("yağışlı gün", "rainy days")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1 px-3">
              {data.daily.map((d, i) => {
                const m = weatherMeta(d.code, lang);
                const Icon = m.icon;
                return (
                  <motion.div
                    key={d.date}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                    className={cn("flex flex-col items-center rounded-xl py-1.5", i === 0 && "bg-white shadow-card")}
                    title={`${m.label}, ${L("yağıntı", "precipitation")} ${formatNumber(d.rain, 1)} mm`}
                  >
                    <span className="text-2xs font-semibold text-ink-2">{i === 0 ? L("Bu gün", "Today") : WEEKDAY[lang][new Date(d.date).getDay()]}</span>
                    <Icon className={cn("my-1 size-4", m.tone)} aria-hidden />
                    <span className="text-2xs text-ink-3 tabular">{d.date.slice(8, 10)}.{d.date.slice(5, 7)}</span>
                  </motion.div>
                );
              })}
            </div>
            <div className="px-3 pb-2">
              <TempLines max={data.daily.map((d) => d.max)} min={data.daily.map((d) => d.min)} />
            </div>
            <div className="border-t border-white/50 px-4 py-1.5 text-[10px] text-ink-3">{L("Mənbə", "Source")}: Open-Meteo</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
