"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/panel";
import { useAdminCompetition, useUpdateCompetition } from "@/features/admin/api";
import { CompetitionForm } from "@/features/admin/competition-form";
import { useL } from "@/lib/i18n";

export default function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const L = useL();
  const router = useRouter();
  const { data: comp, isLoading } = useAdminCompetition(id);
  const update = useUpdateCompetition(id);

  if (isLoading || !comp) return <Skeleton className="h-96" />;
  if (!comp.can_edit) {
    return (
      <div className="py-16 text-center text-ink-2">
        {L("Yalnız qaralama halında olan müsabiqə redaktə edilə bilər.", "Only a draft competition can be edited.")}{" "}
        <Link href={`/admin/competitions/${id}`} className="text-primary hover:underline">{L("Müsabiqəyə qayıt", "Back to competition")}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/competitions" className="hover:text-ink">{L("Müsabiqələr", "Competitions")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/admin/competitions/${id}`} className="font-mono hover:text-ink">{comp.number}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-ink-2">{L("Redaktə", "Edit")}</span>
      </nav>
      <h1 className="text-[28px] tracking-[-0.03em]">{comp.number} · {L("redaktə", "edit")}</h1>
      <CompetitionForm
        initial={comp}
        submitLabel={L("Dəyişiklikləri yadda saxla", "Save changes")}
        pending={update.isPending}
        error={update.error}
        onSubmit={(body) =>
          update.mutate(body, {
            onSuccess: () => {
              toast.success(L("Qaralama yeniləndi", "Draft updated"));
              router.push(`/admin/competitions/${id}`);
            }
          })
        }
      />
    </div>
  );
}
