"use client";

import { RequireRole } from "@/components/layout/require-role";

// Navigation for staff lives in the app sidebar (İdarəetmə section).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={["SPECIALIST", "SUPERVISOR", "ADMIN"]}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">{children}</div>
    </RequireRole>
  );
}
