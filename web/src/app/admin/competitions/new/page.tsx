"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useCreateCompetition } from "@/features/admin/api";
import { CompetitionForm } from "@/features/admin/competition-form";

export default function NewCompetitionPage() {
  const router = useRouter();
  const create = useCreateCompetition();
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/competitions" className="hover:text-ink">Müsabiqələr</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink-2">Yeni müsabiqə</span>
      </nav>
      <div>
        <h1 className="text-xl">Yeni müsabiqə</h1>
        <p className="text-13 text-ink-2">Müsabiqə qaralama kimi yaradılır; dərc edilməsi üçün Rəhbərin təsdiqi lazımdır.</p>
      </div>
      <CompetitionForm
        submitLabel="Qaralamanı yadda saxla"
        pending={create.isPending}
        error={create.error}
        onSubmit={(body) =>
          create.mutate(body, {
            onSuccess: (c) => {
              toast.success(`${c.number} qaralama kimi yaradıldı`);
              router.push(`/admin/competitions/${c.id}`);
            }
          })
        }
      />
    </div>
  );
}
