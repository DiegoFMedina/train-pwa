"use client";

import { useEffect, useState } from "react";
import { useScopeStore } from "@/lib/scope-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

/**
 * Tooltip educativo del switcher de scope. Se muestra UNA sola vez,
 * la primera vez que el user tiene pareja vinculada Y aún no lo vio.
 * Apunta al switcher arriba con un caret y dismiss automático al tap.
 */
export function ScopeTooltip() {
  const hasCouple = useScopeStore((s) => s.hasCouple);
  const seen = useOnboardingStore((s) => s.seenScopeTooltip);
  const setFlag = useOnboardingStore((s) => s.setFlag);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Pequeño delay para que el header haya renderizado y el switcher esté visible
    if (!hasCouple || seen) return;
    const t = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(t);
  }, [hasCouple, seen]);

  if (!mounted || seen || !hasCouple) return null;

  const dismiss = () => {
    setFlag("seenScopeTooltip", true);
    setMounted(false);
  };

  return (
    <>
      {/* Backdrop transparente para que tap fuera también lo cierre */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] anim-in"
      />

      {/* Tooltip apuntando al switcher (top center) */}
      <div
        className="fixed z-50 left-1/2 -translate-x-1/2 anim-in anim-in-delay-1"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 56px)",
          maxWidth: "min(86vw, 320px)",
        }}
        role="dialog"
        aria-live="polite"
      >
        {/* Caret apuntando hacia arriba */}
        <span
          className="block w-3 h-3 rotate-45 absolute -top-1.5 left-1/2 -translate-x-1/2"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
          }}
          aria-hidden
        />
        <div
          className="rounded-2xl p-4 text-[#1a120a] shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
            boxShadow: "0 20px 50px -10px rgba(0,0,0,0.7)",
          }}
        >
          <p className="font-bold mb-1 text-sm">Cambia entre Personal y Compartido</p>
          <p className="text-xs leading-relaxed opacity-90">
            Toca el pill arriba para alternar tu vista. Cada modo muestra solo
            lo que corresponde.
          </p>
          <button
            onClick={dismiss}
            className="mt-3 w-full py-2 rounded-xl bg-[#1a120a]/15 hover:bg-[#1a120a]/25 transition text-xs font-bold"
          >
            Entendido
          </button>
        </div>
      </div>
    </>
  );
}
