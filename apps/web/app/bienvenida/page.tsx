"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

export default function BienvenidaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setFlag = useOnboardingStore((s) => s.setFlag);

  // Si el user ya está autenticado, no tiene sentido mostrar bienvenida
  useEffect(() => {
    if (user) router.replace("/hoy");
  }, [user, router]);

  const start = () => {
    setFlag("welcomed", true);
    router.push("/login");
  };

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center">
        <header className="mb-12 text-center anim-in">
          <p className="eyebrow mb-3">Tu vida ordenada</p>
          <h1 className="title-display text-6xl">
            <span className="gradient-text">Mi Centro</span>
          </h1>
          <p className="mt-4 text-sm text-[color:var(--color-ink-soft)] max-w-[28ch] mx-auto">
            Finanzas, rutinas y dieta — solo o con quien quieras compartir.
          </p>
        </header>

        <div className="space-y-3">
          <Pill
            color="var(--color-accent)"
            title="Finanzas claras"
            subtitle="Gastos, metas y resumen mensual. Tuyo o del hogar."
            delay={0}
          />
          <Pill
            color="var(--color-accent-2)"
            title="Rutinas con racha"
            subtitle="Hábitos diarios o semanales con cumplimiento por persona."
            delay={1}
          />
          <Pill
            color="var(--color-jade)"
            title="Dieta en orden"
            subtitle="Calendario de comidas y lista de compras automática."
            delay={2}
          />
        </div>

        <div className="mt-10 anim-in anim-in-delay-4">
          <button onClick={start} className="btn-primary text-base py-3.5">
            Empezar
          </button>
          <p className="mt-3 text-center text-xs text-[color:var(--color-ink-faint)]">
            ¿Ya tienes cuenta?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-[color:var(--color-accent)] font-medium"
            >
              Entra aquí
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

function Pill({
  color,
  title,
  subtitle,
  delay,
}: {
  color: string;
  title: string;
  subtitle: string;
  delay: number;
}) {
  return (
    <div
      className={`card anim-in anim-in-delay-${delay + 1} flex items-start gap-3`}
    >
      <span
        className="w-9 h-9 rounded-2xl flex-shrink-0"
        style={{
          background: `color-mix(in oklab, ${color} 20%, transparent)`,
          border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-semibold" style={{ color }}>
          {title}
        </p>
        <p className="text-xs text-[color:var(--color-ink-soft)] mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
