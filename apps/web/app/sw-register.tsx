"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker en /sw.js cuando el navegador lo soporta.
 * Solo activa en producción para no chocar con HMR de Next dev.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        // Sin SW: la app sigue funcionando, solo no es instalable / offline.
        console.warn("SW register failed:", e);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
