"use client";

import { ChevronRight, Eye } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { toast } from "sonner";

import { AreaStatusBadge, DeminingBadge } from "@/components/domain/area-status";
import { PurposeChip } from "@/components/domain/purpose-chip";
import { Panel, PanelBody, Skeleton } from "@/components/ui/panel";
import { useAdminArea, useSaveArea } from "@/features/admin/api";
import { AreaForm } from "@/features/admin/area-form";
import { useSession } from "@/features/auth/use-session";
import { useL } from "@/lib/i18n";
import { formatHectares } from "@/lib/utils";

const SOURCE: Record<string, string> = {
  OSM: "OpenStreetMap kənd təsərrüfatı poliqonu",
  SYNTHETIC: "Nümayiş üçün yaradılmış poliqon",
  MANUAL: "Mütəxəssis tərəfindən daxil edilib",
  EKTIS: "EKTİS parsel reyestri"
};

const SOURCE_EN: Record<string, string> = {
  OSM: "OpenStreetMap farmland polygon",
  SYNTHETIC: "Polygon generated for the demo",
  MANUAL: "Entered by a specialist",
  EKTIS: "EKTİS parcel registry"
};

export default function AdminAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const L = useL();
  const { data: area, isLoading, error } = useAdminArea(id);
  const { data: user } = useSession();
  const save = useSaveArea(id);
  const canEdit = user?.role === "SPECIALIST" || user?.role === "ADMIN";

  if (error) return <div className="py-16 text-center text-ink-2">{L("Sahə tapılmadı.", "Plot not found.")}</div>;
  if (isLoading || !area) return <Skeleton className="h-96" />;
  const isPublic = area.status === "AVAILABLE" || area.status === "IN_COMPETITION" || area.status === "ALLOCATED";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <nav className="flex items-center gap-1 text-13 text-ink-3" aria-label="Breadcrumb">
        <Link href="/admin/areas" className="hover:text-ink">{L("Təsərrüfat sahələri", "Farm plots")}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-ink-2">{area.code}</span>
      </nav>

      <Panel>
        <PanelBody className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-lg font-medium">{area.code}</span>
            <AreaStatusBadge status={area.status} />
            <DeminingBadge status={area.demining_status} />
            {isPublic && (
              <Link href={`/areas/${area.code}`} className="ml-auto inline-flex items-center gap-1 text-13 text-primary hover:underline">
                <Eye className="size-3.5" aria-hidden /> {L("Portalda bax", "View on portal")}
              </Link>
            )}
          </div>
          <h1 className="text-[28px] tracking-[-0.03em]">{area.name_az}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-13 text-ink-2">
            <PurposeChip purpose={area.purpose} />
            <span className="tabular font-medium text-ink">{formatHectares(Number(area.area_ha))}</span>
            <span>
              {area.village_name ? L(`${area.village_name} kəndi yaxınlığında, `, `near ${area.village_name}, `) : ""}
              {L(`${area.rayon_name} rayonu`, `${area.rayon_name} district`)}
            </span>
            {area.competition_number && <span>{L("Müsabiqə", "Competition")}: <span className="font-mono">{area.competition_number}</span></span>}
            <span>{L(SOURCE[area.data_source] ?? area.data_source, SOURCE_EN[area.data_source] ?? area.data_source)}</span>
          </div>
        </PanelBody>
      </Panel>

      {canEdit ? (
        <AreaForm
          key={area.id + area.area_ha}
          initial={area}
          submitLabel={L("Dəyişiklikləri yadda saxla", "Save changes")}
          pending={save.isPending}
          error={save.error}
          onSubmit={(body) => save.mutate(body, { onSuccess: () => toast.success(L("Sahə yeniləndi", "Plot updated")) })}
        />
      ) : (
        <p className="text-13 text-ink-3">{L("Sahələri yalnız Mütəxəssis redaktə edə bilər.", "Only a specialist can edit plots.")}</p>
      )}
    </div>
  );
}
