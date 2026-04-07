'use client';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data considered fresh for 5 minutes — no refetch on remount
            staleTime: 5 * 60 * 1000,
            // Keep cache in memory for 10 minutes after unmount
            gcTime: 10 * 60 * 1000,
            // Don't refetch when window regains focus (annoying for dev)
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect
            refetchOnReconnect: false,
            // Retry only once on failure
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
