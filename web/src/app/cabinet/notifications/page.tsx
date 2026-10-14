"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/features/applications/api";
import { cn, formatDateTime } from "@/lib/utils";

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Bildirişlər</h1>
          <p className="mt-1 text-sm text-ink-2">Müraciətlərinizin statusu dəyişdikdə burada bildiriş görünür.</p>
        </div>
        {!!data?.unread && (
          <Button variant="secondary" size="sm" onClick={() => markAll.mutate()}>
            Hamısını oxunmuş et
          </Button>
        )}
      </div>
      <Panel>
        {isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : !data?.items.length ? (
          <div className="px-6 py-14 text-center text-sm text-ink-2">Bildiriş yoxdur.</div>
        ) : (
          <ul className="divide-y divide-border">
            {data.items.map((n) => (
              <li key={n.id} className={cn("flex gap-3 px-4 py-3.5", !n.read_at && "bg-accent-50/60")}>
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")}
                  aria-label={n.read_at ? undefined : "Oxunmayıb"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-medium">{n.title_az}</span>
                    <time className="tabular text-13 text-ink-3">{formatDateTime(n.created_at)}</time>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">{n.body_az}</p>
                  {n.link && (
                    <Link
                      href={n.link}
                      onClick={() => !n.read_at && markRead.mutate(n.id)}
                      className="mt-1 inline-block text-13 font-medium text-primary hover:underline"
                    >
                      Müraciətə bax
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
