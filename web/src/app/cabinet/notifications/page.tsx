"use client";

import { ArrowRight, Bell, BellOff, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EASE } from "@/components/ui/motion";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, Skeleton } from "@/components/ui/panel";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/features/applications/api";
import { useL } from "@/lib/i18n";
import { cn, formatDateTime } from "@/lib/utils";

export default function NotificationsPage() {
  const L = useL();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={L("Kabinet", "Account")}
        title={L("Bildirişlər", "Notifications")}
        description={L("Müraciətlərinizin statusu dəyişdikdə burada bildiriş görünür.", "You get a notification here whenever an application changes status.")}
        actions={
          !!data?.unread && (
            <Button variant="secondary" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck /> {L("Hamısını oxunmuş et", "Mark all as read")}
            </Button>
          )
        }
      />
      <Panel className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !data?.items.length ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-surface-2 text-ink-3">
              <BellOff className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm text-ink-2">{L("Bildiriş yoxdur.", "No notifications.")}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {data.items.map((n, i) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: Math.min(i, 10) * 0.04 }}
                  className={cn("flex gap-4 rounded-2xl p-4 transition-colors", !n.read_at ? "bg-accent-50" : "hover:bg-surface-2/60")}
                >
                  <span
                    className={cn(
                      "relative flex size-11 shrink-0 items-center justify-center rounded-2xl",
                      n.read_at ? "bg-surface-2 text-ink-3" : "bg-accent text-ink"
                    )}
                  >
                    <Bell className="size-5" aria-hidden />
                    {!n.read_at && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-accent-50" aria-label={L("Oxunmayıb", "Unread")} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-sm font-semibold">{n.title_az}</span>
                      <time className="tabular text-13 text-ink-3">{formatDateTime(n.created_at)}</time>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-2">{n.body_az}</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => !n.read_at && markRead.mutate(n.id)}
                          className="group inline-flex items-center gap-1 text-13 font-semibold text-primary"
                        >
                          {L("Müraciətə bax", "View application")} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      )}
                      {!n.read_at && (
                        <button type="button" onClick={() => markRead.mutate(n.id)} className="text-13 font-medium text-ink-3 hover:text-ink">
                          {L("Oxunmuş et", "Mark as read")}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </div>
  );
}
