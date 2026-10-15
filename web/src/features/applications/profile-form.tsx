"use client";

import { Building2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRayons } from "@/features/areas/api";
import { selectClass } from "@/features/areas/filter-panel";
import { useSession } from "@/features/auth/use-session";
import { ApiError } from "@/lib/api/client";
import { useL } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { type Profile, type ProfileInput, useSaveProfile } from "./api";

const LEGAL_FORMS = ["MMC", "ASC", "QSC", "Kəndli (fermer) təsərrüfatı", "Kooperativ"];

function emptyProfile(name = "", email = ""): ProfileInput {
  return {
    type: "COMPANY",
    fin: "",
    voen: "",
    full_name: name,
    company_name: "",
    legal_form: "MMC",
    phone: "",
    email,
    address: "",
    is_local: false,
    origin_rayon_id: null
  };
}

/** Sahibkar or company data (R3.2). Used in the profile page and as wizard step 1. */
export function ProfileForm({
  profile,
  submitLabel,
  onSaved,
  secondaryAction
}: {
  profile: Profile | null | undefined;
  submitLabel?: string;
  onSaved?: (p: Profile) => void;
  secondaryAction?: React.ReactNode;
}) {
  const { data: user } = useSession();
  const { data: rayons } = useRayons();
  const L = useL();
  const save = useSaveProfile();
  const [form, setForm] = useState<ProfileInput>(() => emptyProfile(user?.full_name, user?.email));

  useEffect(() => {
    if (profile) {
      setForm({ ...profile, fin: profile.fin ?? "", voen: profile.voen ?? "" });
    } else if (user) {
      setForm((f) => ({ ...f, full_name: f.full_name || user.full_name, email: f.email || user.email }));
    }
  }, [profile, user]);

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const company = form.type === "COMPANY";
  const err = save.error instanceof ApiError ? save.error : null;
  const fe = (name: string) => err?.forField(name);
  const general = err && err.fieldErrors.every((e) => !e.field || e.field === "") ? err.message : err?.fieldErrors.find((e) => !e.field)?.message;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        ...form,
        fin: company ? null : form.fin,
        voen: company ? form.voen : form.voen || null,
        company_name: company ? form.company_name : null,
        legal_form: company ? form.legal_form : null
      },
      { onSuccess: (p) => onSaved?.(p) }
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={general ?? null} />
      <fieldset>
        <legend className="mb-2 text-13 font-medium text-ink-2">{L("Müraciət edən", "Applicant")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["COMPANY", L("Hüquqi şəxs", "Company"), L("Şirkət, VÖEN ilə", "Business, with tax ID (VÖEN)"), Building2],
              ["INDIVIDUAL", L("Fiziki şəxs", "Individual"), L("Fərdi, FİN ilə", "Person, with personal ID (FİN)"), UserRound]
            ] as const
          ).map(([value, label, hint, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={form.type === value}
              onClick={() => set("type", value)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200",
                form.type === value ? "border-primary bg-primary-50 shadow-[inset_0_0_0_1px_rgb(var(--primary))]" : "border-border bg-surface hover:border-border-strong"
              )}
            >
              <Icon className="mt-0.5 size-4 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-13 text-ink-3">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {company ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="company_name" label={L("Şirkətin adı", "Company name")} required error={fe("company_name")} className="sm:col-span-2">
            <Input id="company_name" value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field id="voen" label="VÖEN" required hint={L("10 rəqəm", "10 digits")} error={fe("voen")}>
            <Input id="voen" inputMode="numeric" maxLength={10} className="font-mono" value={form.voen ?? ""} onChange={(e) => set("voen", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field id="legal_form" label={L("Təşkilati-hüquqi forma", "Legal form")}>
            <select id="legal_form" className={selectClass} value={form.legal_form ?? ""} onChange={(e) => set("legal_form", e.target.value)}>
              {LEGAL_FORMS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field id="full_name" label={L("Nümayəndənin adı, soyadı", "Representative's full name")} required error={fe("full_name")} className="sm:col-span-2">
            <Input id="full_name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="full_name" label={L("Ad, soyad, ata adı", "Full name")} required error={fe("full_name")} className="sm:col-span-2">
            <Input id="full_name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </Field>
          <Field id="fin" label="FİN" required hint={L("Şəxsiyyət vəsiqəsindəki 7 simvol", "7 characters from the ID card")} error={fe("fin")}>
            <Input id="fin" maxLength={7} className="font-mono uppercase" value={form.fin ?? ""} onChange={(e) => set("fin", e.target.value.toUpperCase())} />
          </Field>
          <Field id="voen_ind" label={L("VÖEN (fərdi sahibkar)", "VÖEN (sole trader)")} hint={L("Varsa", "If any")} error={fe("voen")}>
            <Input id="voen_ind" inputMode="numeric" maxLength={10} className="font-mono" value={form.voen ?? ""} onChange={(e) => set("voen", e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="phone" label={L("Telefon", "Phone")} required error={fe("phone")}>
          <Input id="phone" type="tel" placeholder="+994 50 000 00 00" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field id="email" label={L("E-poçt", "E-mail")} required error={fe("email")}>
          <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field id="address" label={L("Ünvan", "Address")} className="sm:col-span-2">
          <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </Field>
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface-2/60 p-4">
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={!!form.is_local} onCheckedChange={(v) => set("is_local", v === true)} />
          <span>
            {L("Yerli sahibkaram", "I am a local entrepreneur")}
            <span className="block text-13 text-ink-3">{L("Bölgədə qeydiyyatdayam və ya bölgədən olan məcburi köçkünəm", "Registered in the region or an internally displaced person from it")}</span>
          </span>
        </label>
        {form.is_local && (
          <Field id="origin" label={L("Hansı rayondan", "District of origin")}>
            <select
              id="origin"
              className={selectClass}
              value={form.origin_rayon_id ?? ""}
              onChange={(e) => set("origin_rayon_id", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{L("Seçin", "Select")}</option>
              {rayons?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_az}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {secondaryAction ?? <span />}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? L("Yadda saxlanılır…", "Saving…") : submitLabel ?? L("Yadda saxla", "Save")}
        </Button>
      </div>
    </form>
  );
}
