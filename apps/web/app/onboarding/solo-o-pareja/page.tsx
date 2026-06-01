"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

type Choice = "solo" | "pareja" | null;

export default function SoloOParejaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setFlag = useOnboardingStore((s) => s.setFlag);
  const [choice, setChoice] = useState<Choice>(null);

  // Guard: si no hay sesión, vuelve a login
  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const advance = () => {
    setFlag("choseCoupleStep", true);
    if (choice === "pareja") {
      router.push("/onboarding/pareja");
    } else {
      router.push("/onboarding/listo");
    }
  };

  const skip = () => {
    setFlag("choseCoupleStep", true);
    router.push("/onboarding/listo");
  };

  if (!user) return null;

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      <header className="mb-8 anim-in">
        <p className="eyebrow mb-2">Paso 1 de 2</p>
        <h1 className="title-display text-4xl">
          ¿Cómo vas a usar
          <br />
          <span className="gradient-text">Mi Centro</span>?
        </h1>
        <p className="mt-3 text-sm text-[color:var(--color-ink-soft)]">
          Esta decisión cambia un poco la app. Puedes cambiarla después.
        </p>
      </header>

      <div className="space-y-3 flex-1">
        <ChoiceCard
          active={choice === "solo"}
          onClick={() => setChoice("solo")}
          icon="🔒"
          title="Solo por ahora"
          subtitle="Todo es privado. Puedes invitar a alguien después desde tu perfil."
          delay={0}
        />
        <ChoiceCard
          active={choice === "pareja"}
          onClick={() => setChoice("pareja")}
          icon="💞"
          title="Con mi pareja"
          subtitle="Comparte finanzas, rutinas y comidas con quien quieras."
          delay={1}
        />
      </div>

      <div className="mt-8 space-y-2 anim-in anim-in-delay-3">
        <button
          onClick={advance}
          disabled={!choice}
          className="btn-primary text-base py-3.5"
        >
          Continuar
        </button>
        <button
          onClick={skip}
          className="w-full py-3 text-sm font-medium text-[color:var(--color-ink-faint)]"
        >
          Saltar — decido después
        </button>
      </div>
    </main>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  delay,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
  delay: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left p-5 rounded-3xl border transition-all anim-in anim-in-delay-${delay + 1} ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-surface-2)] scale-[1.01]"
          : "border-[color:var(--color-line)] hover:bg-[color:var(--color-surface)]"
      }`}
    >
      <div className="flex items-start gap-4">
        <span
          className="w-12 h-12 rounded-2xl grid place-items-center text-2xl flex-shrink-0"
          style={{
            background: "color-mix(in oklab, var(--color-accent) 14%, transparent)",
          }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">{title}</p>
          <p className="text-xs text-[color:var(--color-ink-soft)] mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>
        <span
          className={`w-5 h-5 rounded-full border-2 grid place-items-center flex-shrink-0 mt-1 transition ${
            active
              ? "border-[color:var(--color-accent)]"
              : "border-[color:var(--color-line-strong)]"
          }`}
        >
          {active && (
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
          )}
        </span>
      </div>
    </button>
  );
}
