"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCreateCompetition } from "@/features/admin/api";
import { CompetitionForm } from "@/features/admin/competition-form";
import { useL } from "@/lib/i18n";

export default function NewCompetitionPage() {
  const L = useL();
  const router = useRouter();
  const create = useCreateCompetition();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/competitions" className="hover:text-ink">{L("Müsabiqələr", "Competitions")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink-2">{L("Yeni müsabiqə", "New competition")}</span>
      </nav>
      <div>
        <h1 className="text-[28px] tracking-[-0.03em]">{L("Yeni müsabiqə", "New competition")}</h1>
        <p className="text-13 text-ink-2">{L("Müsabiqə qaralama kimi yaradılır; dərc edilməsi üçün Rəhbərin təsdiqi lazımdır.", "The competition is created as a draft; a supervisor must approve it before it is published.")}</p>
      </div>
      <CompetitionForm
        submitLabel={L("Qaralamanı yadda saxla", "Save draft")}
        pending={create.isPending}
        error={create.error}
        onSubmit={(body) =>
          create.mutate(body, {
            onSuccess: (c) => {
              toast.success(L(`${c.number} qaralama kimi yaradıldı`, `${c.number} created as a draft`));
              router.push(`/admin/competitions/${c.id}`);
            }
          })
        }
      />
    </div>
  );
}
