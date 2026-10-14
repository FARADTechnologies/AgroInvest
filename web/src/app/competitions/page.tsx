"use client";

import Link from "next/link";

import { DeadlineBadge } from "@/components/domain/deadline";
import { Skeleton } from "@/components/ui/panel";
import { useCompetitions } from "@/features/areas/api";
import { cn, formatDate, formatHectares } from "@/lib/utils";

export default function CompetitionsPage() {
  const { data, isLoading } = useCompetitions();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <h1 className="text-2xl">Müsabiqələr</h1>
      <p className="mt-1 text-sm text-ink-2">Nazirlik tərəfindən təsdiq edilib elan olunmuş investisiya müsabiqələri.</p>
      <ul className="mt-6 divide-y divide-border rounded-md border border-border bg-surface">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="p-5">
              <Skeleton className="h-14" />
            </li>
          ))}
        {data?.map((c) => (
          <li key={c.id}>
            <Link href={`/competitions/${c.number}`} className="grid gap-2 px-5 py-4 hover:bg-surface-2 md:grid-cols-[1fr_200px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-13 font-medium text-primary">{c.number}</span>
                  <span
                    className={cn(
                      "rounded-sm px-2 py-0.5 text-2xs font-medium uppercase tracking-wide",
                      c.is_open ? "bg-status-won-bg text-status-won-fg" : "bg-status-draft-bg text-status-draft-fg"
                    )}
                  >
                    {c.is_open ? "Qəbul davam edir" : "Qəbul başa çatıb"}
                  </span>
                </div>
                <h2 className="mt-1 text-15">{c.title_az}</h2>
                <p className="mt-0.5 line-clamp-2 text-13 text-ink-2">{c.description_az}</p>
              </div>
              <div className="text-13 text-ink-2 md:text-right">
                <div className="tabular">
                  {c.area_count} sahə · {formatHectares(Number(c.total_ha))}
                </div>
                <div>Son müraciət: {formatDate(c.deadline_at)}</div>
                <DeadlineBadge iso={c.deadline_at} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
