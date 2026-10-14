"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
        {children}
        <Toaster position="top-right" richColors={false} closeButton />
      </MessagesProvider>
    </QueryClientProvider>
  );
}
