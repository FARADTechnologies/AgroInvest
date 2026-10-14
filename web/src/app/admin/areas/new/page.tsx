"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { RequireRole } from "@/components/layout/require-role";
import { useSaveArea } from "@/features/admin/api";
import { AreaForm } from "@/features/admin/area-form";

export default function NewAreaPage() {
  const router = useRouter();
  const save = useSaveArea(null);
  return (
    <RequireRole roles={["SPECIALIST", "ADMIN"]}>
      <div className="mx-auto max-w-5xl space-y-4">
        <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
          <Link href="/admin/areas" className="hover:text-ink">Təsərrüfat sahələri</Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span className="text-ink-2">Yeni sahə</span>
        </nav>
        <div>
          <h1 className="text-xl">Yeni təsərrüfat sahəsi</h1>
          <p className="text-13 text-ink-2">Kod, ölçü, rayon və ən yaxın kənd poliqona görə avtomatik təyin edilir.</p>
        </div>
        <AreaForm
          submitLabel="Sahəni əlavə et"
          pending={save.isPending}
          error={save.error}
          onSubmit={(body) =>
            save.mutate(body, {
              onSuccess: (a) => {
                toast.success(`${a.code} əlavə edildi`);
                router.push(`/admin/areas/${a.id}`);
              }
            })
          }
        />
      </div>
    </RequireRole>
  );
}
