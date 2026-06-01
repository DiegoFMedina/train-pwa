"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "mc:install-dismissed-at";
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS expone navigator.standalone; el resto usa display-mode media query.
  const iosStandalone = "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true;
  const mqStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return iosStandalone || mqStandalone;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !/MSStream/.test(ua);
}

function wasDismissedRecently(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const t = Number(raw);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < REMIND_AFTER_MS;
}

function rememberDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage no disponible (modo privado, etc.) — silenciamos.
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;

    // Android / desktop con SW: el browser dispara beforeinstallprompt.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS no dispara nada — mostramos hint con instrucciones, con delay.
    const iosTimer = isIOS()
      ? window.setTimeout(() => setShowIosHint(true), 3000)
      : null;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    rememberDismissed();
    setDeferred(null);
    setShowIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") rememberDismissed();
    } finally {
      setBusy(false);
      setDeferred(null);
    }
  };

  // Android / desktop: prompt nativo accesible.
  if (deferred) {
    return (
      <PromptShell onDismiss={dismiss}>
        <p className="font-semibold">Instalar Mi Centro</p>
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-0.5">
          Acceso directo en pantalla de inicio, sin barra del navegador.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={dismiss}
            className="flex-1 py-2 rounded-lg bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-xs font-medium"
          >
            Más tarde
          </button>
          <button
            onClick={install}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-[#1a120a]"
            style={{
              background:
                "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
            }}
          >
            {busy ? "…" : "Instalar"}
          </button>
        </div>
      </PromptShell>
    );
  }

  // iOS: instrucciones manuales.
  if (showIosHint) {
    return (
      <PromptShell onDismiss={dismiss}>
        <p className="font-semibold">Añadir a pantalla de inicio</p>
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-1 leading-relaxed">
          En Safari toca{" "}
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded bg-[color:var(--color-surface-2)] mx-0.5 align-middle"
            aria-label="Compartir"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
              <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {" "}Compartir y luego <b>"Añadir a pantalla de inicio"</b>.
        </p>
        <button
          onClick={dismiss}
          className="w-full mt-3 py-2 rounded-lg bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-xs font-medium"
        >
          Entendido
        </button>
      </PromptShell>
    );
  }

  return null;
}

function PromptShell({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed z-40 left-4 right-4 bottom-[calc(env(safe-area-inset-bottom,0)+96px)] mx-auto max-w-md"
    >
      <div className="relative card !pr-9 shadow-2xl border-[color:var(--color-accent)]/30">
        <button
          onClick={onDismiss}
          aria-label="Descartar"
          className="absolute top-3 right-3 w-6 h-6 grid place-items-center rounded-full text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-ink)]"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
