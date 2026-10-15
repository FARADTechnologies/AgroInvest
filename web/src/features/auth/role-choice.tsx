"use client";

import { Briefcase, LandPlot } from "lucide-react";

import { cn } from "@/lib/utils";

export type PartyRole = "INVESTOR" | "ENTREPRENEUR";

export const PARTY: Record<PartyRole, { label: string; text: string; icon: typeof Briefcase }> = {
  INVESTOR: {
    label: "İnvestor",
    text: "Büdcənizi və maraq sahələrinizi qeyd edin, uyğun elanlara müraciət edin.",
    icon: Briefcase
  },
  ENTREPRENEUR: {
    label: "Sahibkar",
    text: "Sahəni xəritədə qeyd edib elan yerləşdirin, investorların müraciətlərini izləyin.",
    icon: LandPlot
  }
};

export function parseRole(value: string | null): PartyRole {
  return value === "sahibkar" || value === "ENTREPRENEUR" ? "ENTREPRENEUR" : "INVESTOR";
}

/** The two kinds of outside users; staff accounts are never chosen here. */
export function RoleChoice({ value, onChange }: { value: PartyRole; onChange: (role: PartyRole) => void }) {
  return (
    <div role="radiogroup" aria-label="Hesab növü" className="grid grid-cols-2 gap-2">
      {(Object.keys(PARTY) as PartyRole[]).map((role) => {
        const { label, text, icon: Icon } = PARTY[role];
        const active = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => onChange(role)}
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
