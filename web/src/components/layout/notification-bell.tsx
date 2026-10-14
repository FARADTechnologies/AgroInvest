"use client";

import { Bell } from "lucide-react";
import Link from "next/link";

/** Link to the applicant's notifications; the unread counter is added with the notifications API. */
export function NotificationBell() {
  return (
    <Link
      href="/cabinet/notifications"
      aria-label="Bildirişlər"
      title="Bildirişlər"
      className="relative rounded-md p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <Bell className="size-4" />
    </Link>
  );
}
