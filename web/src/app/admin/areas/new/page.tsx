"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RequireRole } from "@/components/layout/require-role";
import { useSaveArea } from "@/features/admin/api";
import { AreaForm } from "@/features/admin/area-form";
import { useL } from "@/lib/i18n";

export default function NewAreaPage() {
  const L = useL();
  const router = useRouter();
  const save = useSaveArea(null);
  return (
    <RequireRole roles={["SPECIALIST", "ADMIN"]}>
      <div className="mx-auto max-w-5xl space-y-4">
        <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
          <Link href="/admin/areas" className="hover:text-ink">{L("Təsərrüfat sahələri", "Farm plots")}</Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="text-ink-2">{L("Yeni sahə", "New plot")}</span>
        </nav>
        <div>
          <h1 className="text-[28px] tracking-[-0.03em]">{L("Yeni təsərrüfat sahəsi", "New farm plot")}</h1>
          <p className="text-13 text-ink-2">{L("Kod, ölçü, rayon və ən yaxın kənd poliqona görə avtomatik təyin edilir.", "Code, size, district and nearest village are derived from the polygon.")}</p>
        </div>
        <AreaForm
          submitLabel={L("Sahəni əlavə et", "Add plot")}
          pending={save.isPending}
          error={save.error}
          onSubmit={(body) =>
            save.mutate(body, {
              onSuccess: (a) => {
                toast.success(L(`${a.code} əlavə edildi`, `${a.code} added`));
                router.push(`/admin/areas/${a.id}`);
              }
            })
          }
        />
      </div>
    </RequireRole>
  );
}
