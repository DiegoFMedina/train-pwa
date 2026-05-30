"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

function AuthHydrator({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const did = useRef(false);

  useEffect(() => {
    if (did.current) return;
    did.current = true;
    (async () => {
      try {
        const r = await api.auth.refresh();
        setAccessToken(r.access_token);
        const me = await api.me.get();
        setUser(me);
      } catch {
        // sin sesión válida → seguimos como anónimos
      } finally {
        setHydrated(true);
      }
    })();
  }, [setAccessToken, setUser, setHydrated]);

  if (!hydrated) {
    return (
      <div className="min-h-dvh grid place-items-center text-[color:var(--color-ink-faint)]">
        <span className="eyebrow">Cargando…</span>
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={qc}>
      <AuthHydrator>{children}</AuthHydrator>
    </QueryClientProvider>
  );
}
