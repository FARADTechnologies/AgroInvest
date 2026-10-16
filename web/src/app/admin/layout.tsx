"use client";

import { AdminShell } from "@/components/layout/admin-shell";
import { RequireRole } from "@/components/layout/require-role";

// The administration console has its own frame, apart from the public portal.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["SPECIALIST", "SUPERVISOR", "ADMIN"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
