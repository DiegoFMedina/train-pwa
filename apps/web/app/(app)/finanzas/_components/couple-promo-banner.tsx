"use client";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";

/**
 * Banner discreto en Finanzas para usuarios sin pareja vinculada.
 * Persistible — dismiss lo guarda y no vuelve a mostrarse hasta reset.
 */
export function CouplePromoBanner({ hasCouple }: { hasCouple: boolean }) {
  const router = useRouter();
  const dismissed = useOnboardingStore((s) => s.dismissedCoupleBanner);
  const setFlag = useOnboardingStore((s) => s.setFlag);

  if (hasCouple || dismissed) return null;

  return (
    <div
      className="card mb-6 flex items-start gap-3 anim-in"
      style={{
        borderColor: "color-mix(in oklab, var(--color-jade) 30%, transparent)",
      }}
    >
      <span
        className="w-10 h-10 rounded-2xl grid place-items-center text-lg flex-shrink-0"
        style={{
          background: "color-mix(in oklab, var(--color-jade) 18%, transparent)",
        }}
      >
        💞
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">¿Compartes gastos con alguien?</p>
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-0.5 leading-relaxed">
          Vincula tu pareja y registren los gastos del hogar juntos.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => router.push("/perfil")}
            className="text-xs px-3 py-1.5 rounded-full font-semibold text-[#0a1a12]"
            style={{ background: "var(--color-jade)" }}
          >
            Vincular pareja
          </button>
          <button
            onClick={() => setFlag("dismissedCoupleBanner", true)}
            className="text-xs px-3 py-1.5 rounded-full text-[color:var(--color-ink-faint)]"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
