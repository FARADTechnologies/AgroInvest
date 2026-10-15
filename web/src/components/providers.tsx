"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Toaster } from "sonner";

import { MessagesProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 }
        }
      })
  );
  return (
    <QueryClientProvider client={client}>
      <MessagesProvider>
        {/* Animations step aside for visitors who ask for reduced motion. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster position="top-right" richColors={false} closeButton toastOptions={{ className: "!rounded-2xl !border-border !shadow-float" }} />
      </MessagesProvider>
    </QueryClientProvider>
  );
}
