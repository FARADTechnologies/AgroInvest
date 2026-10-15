"use client";

import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { useNotifications } from "@/features/applications/api";
import { useL } from "@/lib/i18n";

/** The applicant's notifications with an unread counter (polled every 15 s). */
export function NotificationBell() {
  const L = useL();
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <Link
      href="/cabinet/notifications"
      aria-label={unread ? L(`Bildirişlər: ${unread} oxunmamış`, `Notifications: ${unread} unread`) : L("Bildirişlər", "Notifications")}
      title={L("Bildirişlər", "Notifications")}
      className="relative flex size-10 items-center justify-center rounded-full border border-border bg-surface text-ink-2 shadow-card transition hover:text-ink"
    >
      <motion.span
        key={unread}
        initial={{ rotate: 0 }}
        animate={unread ? { rotate: [0, -16, 14, -8, 6, 0] } : {}}
        transition={{ duration: 0.7 }}
        className="flex"
      >
        <Bell className="size-[18px]" />
      </motion.span>
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-2xs font-bold leading-5 text-ink ring-2 ring-bg tabular"
          >
            {unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
