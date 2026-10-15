"use client";

import { usePathname } from "next/navigation";

import { RequireRole } from "@/components/layout/require-role";

// Cabinet navigation lives in the app sidebar (Kabinet section).
export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // The wizard brings its own gate and uses the full width.
  if (pathname.startsWith("/cabinet/applications/new")) return <>{children}</>;
  return (
    <RequireRole roles={["ENTREPRENEUR"]}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">{children}</div>
    </RequireRole>
  );
}
