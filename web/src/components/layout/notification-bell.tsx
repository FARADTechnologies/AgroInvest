"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

import { useNotifications } from "@/features/applications/api";

/** The applicant's notifications with an unread counter (polled every 15 s). */
export function NotificationBell() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <Link
      href="/cabinet/notifications"
      aria-label={unread ? `Bildirişlər: ${unread} oxunmamış` : "Bildirişlər"}
      title="Bildirişlər"
      className="relative rounded-md p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white tabular">
          {unread}
        </span>
      )}
    </Link>
  );
}
