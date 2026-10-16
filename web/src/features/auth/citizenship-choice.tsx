"use client";

import { Globe, IdCard } from "lucide-react";

import { cn } from "@/lib/utils";

export type Citizenship = "AZ" | "FOREIGN";

export const CITIZENSHIP: Record<Citizenship, { label: string; text: string; icon: typeof Globe }> = {
  AZ: {
    label: "Azərbaycan vətəndaşı",
    text: "Şəxsiyyət vəsiqəsinin FİN kodu ilə qeydiyyat.",
    icon: IdCard
  },
  FOREIGN: {
    label: "Xarici vətəndaş",
    text: "Pasport nömrəsi və vətəndaşı olduğunuz ölkə ilə qeydiyyat.",
    icon: Globe
  }
};

export function parseCitizenship(value: string | null): Citizenship {
  return value === "FOREIGN" || value === "xarici" ? "FOREIGN" : "AZ";
}

/** Everyone registers the same kind of account; only the identity document differs. */
export function CitizenshipChoice({ value, onChange }: { value: Citizenship; onChange: (c: Citizenship) => void }) {
  return (
    <div role="radiogroup" aria-label="Vətəndaşlıq" className="grid grid-cols-2 gap-2">
      {(Object.keys(CITIZENSHIP) as Citizenship[]).map((c) => {
        const { label, text, icon: Icon } = CITIZENSHIP[c];
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => onChange(c)}
            className={cn(
              "rounded-2xl border px-3.5 py-3 text-left transition-colors",
              active ? "border-primary bg-primary-50 shadow-card" : "border-border bg-surface hover:border-primary/40"
            )}
          >
            <span className={cn("flex items-center gap-2 text-sm font-medium", active ? "text-primary" : "text-ink")}>
              <Icon className="size-4" aria-hidden /> {label}
            </span>
            <span className="mt-1 block text-13 leading-snug text-ink-2">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
