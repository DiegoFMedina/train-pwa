"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

interface ModuleCard {
  href: string;
  emoji: string;
  title: string;
  cta: string;
  color: string;
}

const MODULES: ModuleCard[] = [
  {
    href: "/finanzas",
    emoji: "$",
    title: "Finanzas",
    cta: "Registra tu primer gasto",
    color: "var(--color-accent)",
  },
  {
    href: "/rutinas",
    emoji: "✓",
    title: "Rutinas",
    cta: "Crea tu primer hábito",
    color: "var(--color-accent-2)",
  },
  {
    href: "/dieta",
    emoji: "✦",
    title: "Dieta",
    cta: "Agrega un plato al catálogo",
    color: "var(--color-jade)",
  },
];

export default function OnboardingListoPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setFlag = useOnboardingStore((s) => s.setFlag);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const goTo = (href: string) => {
    setFlag("finished", true);
    router.push(href);
  };

  const finish = () => {
    setFlag("finished", true);
    router.push("/hoy");
  };

  if (!user) return null;
  const firstName = user.name.split(" ")[0];

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      <header className="mb-8 text-center anim-in">
        <p className="eyebrow mb-3">¡Listo!</p>
        <h1 className="title-display text-5xl">
          Bienvenido,
          <br />
          <span className="gradient-text italic">{firstName}</span>
        </h1>
        <p className="mt-4 text-sm text-[color:var(--color-ink-soft)]">
          Empieza por donde quieras. Todo está vacío hasta que tú lo armes.
        </p>
      </header>

      <div className="space-y-3 flex-1">
        {MODULES.map((m, i) => (
          <button
            key={m.href}
            onClick={() => goTo(m.href)}
            className={`card card-interactive flex items-center gap-4 text-left anim-in anim-in-delay-${i + 1}`}
          >
            <span
              className="w-12 h-12 rounded-2xl grid place-items-center text-xl font-bold flex-shrink-0"
              style={{
                background: `color-mix(in oklab, ${m.color} 18%, transparent)`,
                color: m.color,
              }}
            >
              {m.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold" style={{ color: m.color }}>
                {m.title}
              </p>
              <p className="text-xs text-[color:var(--color-ink-soft)] mt-0.5">
                {m.cta}
              </p>
            </div>
            <span className="text-[color:var(--color-ink-faint)] flex-shrink-0" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 anim-in anim-in-delay-4">
        <button onClick={finish} className="btn-ghost w-full text-base py-3">
          Ir a Hoy
        </button>
      </div>
    </main>
  );
}
