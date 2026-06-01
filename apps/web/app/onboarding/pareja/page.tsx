"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useScopeStore } from "@/lib/scope-store";

type Step = "choose" | "create" | "join" | "created";
type Mode = "separate" | "unified";

export default function OnboardingParejaPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setHasCouple = useScopeStore((s) => s.setHasCouple);
  const setFlag = useOnboardingStore((s) => s.setFlag);

  const [step, setStep] = useState<Step>("choose");
  const [name, setName] = useState("Nuestra cuenta");
  const [mode, setMode] = useState<Mode>("separate");
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  const createMut = useMutation({
    mutationFn: async () => {
      const couple = await api.couples.create(
        name.trim() || "Nuestra cuenta",
        mode,
      );
      // Generar invitación inmediatamente para que el usuario tenga código
      const inv = await api.couples.createInvitation(couple.id, 24);
      return { couple, code: inv.code };
    },
    onSuccess: (r) => {
      setCreatedCode(r.code);
      setHasCouple(true);
      setStep("created");
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const joinMut = useMutation({
    mutationFn: () => api.couples.join(code.trim().toUpperCase()),
    onSuccess: () => {
      setHasCouple(true);
      // En unified force scope al couple
      finish();
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const finish = () => {
    setFlag("choseCoupleStep", true);
    router.replace("/onboarding/listo");
  };

  const copyCode = () => {
    if (createdCode) {
      void navigator.clipboard?.writeText(createdCode).catch(() => null);
    }
  };

  const shareCode = async () => {
    if (!createdCode) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as { share: (data: ShareData) => Promise<void> }).share({
          title: "Únete a Mi Centro",
          text: `Te invito a compartir finanzas en Mi Centro. Usa este código: ${createdCode}`,
        });
      } catch {
        // user canceled
      }
    } else {
      copyCode();
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-dvh flex flex-col px-6 py-10 max-w-md mx-auto">
      <header className="mb-8 anim-in">
        <p className="eyebrow mb-2">Paso 2 de 2 — Pareja</p>
        <h1 className="title-display text-4xl">
          {step === "choose" && (
            <>
              ¿Tienes
              <br />
              <span className="gradient-text">código</span>?
            </>
          )}
          {step === "create" && (
            <>
              Crea
              <br />
              <span className="gradient-text">tu espacio</span>
            </>
          )}
          {step === "join" && (
            <>
              Únete con
              <br />
              <span className="gradient-text">código</span>
            </>
          )}
          {step === "created" && (
            <>
              ¡Espacio
              <br />
              <span className="gradient-text">creado!</span>
            </>
          )}
        </h1>
      </header>

      {step === "choose" && (
        <div className="space-y-3 flex-1">
          <ChoiceCard
            onClick={() => setStep("create")}
            icon="✦"
            title="Crear espacio nuevo"
            subtitle="Tú serás el dueño. Generamos un código para invitar a tu pareja."
          />
          <ChoiceCard
            onClick={() => setStep("join")}
            icon="✉"
            title="Tengo un código"
            subtitle="Tu pareja te compartió uno. Únete a su espacio."
          />
        </div>
      )}

      {step === "create" && (
        <div className="space-y-4 flex-1">
          <div>
            <label className="eyebrow block mb-2">Nombre del espacio</label>
            <input
              className="input"
              placeholder="Casa con María"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="eyebrow block">Modo financiero</label>
            <ModeCard
              active={mode === "separate"}
              onClick={() => setMode("separate")}
              title="Personal + compartido"
              subtitle="Cada uno mantiene sus finanzas privadas. Lo del hogar va a un pool aparte."
              recommended
            />
            <ModeCard
              active={mode === "unified"}
              onClick={() => setMode("unified")}
              title="Todo compartido"
              subtitle="Sin secretos. Ambos ven todos los ingresos y gastos."
            />
            <p className="text-[10px] text-[color:var(--color-ink-faint)] px-1">
              Podrás cambiarlo después sin perder datos.
            </p>
          </div>

          {error && (
            <p className="text-sm text-[color:var(--color-down)]">{error}</p>
          )}
        </div>
      )}

      {step === "join" && (
        <div className="space-y-4 flex-1">
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            Pídele a tu pareja que genere un código desde su perfil.
          </p>
          <input
            className="input mono uppercase tracking-[0.3em] text-center text-xl py-4"
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={16}
            autoFocus
          />
          {error && (
            <p className="text-sm text-[color:var(--color-down)]">{error}</p>
          )}
        </div>
      )}

      {step === "created" && createdCode && (
        <div className="flex-1 flex flex-col justify-center text-center">
          <p className="eyebrow mb-3">Comparte este código</p>
          <div className="card-feature py-8 mb-4">
            <p className="mono text-4xl font-bold tracking-[0.25em] gradient-text">
              {createdCode}
            </p>
            <p className="mt-3 text-xs text-[color:var(--color-ink-faint)]">
              Caduca en 24 horas
            </p>
          </div>
          <p className="text-sm text-[color:var(--color-ink-soft)] mb-6">
            Tu pareja debe entrar con este código desde su pantalla de bienvenida.
          </p>
          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="btn-tonal flex-1"
            >
              Copiar
            </button>
            <button onClick={shareCode} className="btn-primary flex-1">
              Compartir
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-2">
        {step === "choose" && (
          <button
            onClick={() => router.back()}
            className="w-full py-3 text-sm font-medium text-[color:var(--color-ink-faint)]"
          >
            Volver
          </button>
        )}
        {step === "create" && (
          <>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !name.trim()}
              className="btn-primary text-base py-3.5"
            >
              {createMut.isPending ? "Creando…" : "Crear espacio"}
            </button>
            <button
              onClick={() => {
                setStep("choose");
                setError(null);
              }}
              className="w-full py-3 text-sm font-medium text-[color:var(--color-ink-faint)]"
            >
              Volver
            </button>
          </>
        )}
        {step === "join" && (
          <>
            <button
              onClick={() => joinMut.mutate()}
              disabled={joinMut.isPending || code.trim().length < 4}
              className="btn-primary text-base py-3.5"
            >
              {joinMut.isPending ? "Uniéndome…" : "Unirme"}
            </button>
            <button
              onClick={() => {
                setStep("choose");
                setError(null);
              }}
              className="w-full py-3 text-sm font-medium text-[color:var(--color-ink-faint)]"
            >
              Volver
            </button>
          </>
        )}
        {step === "created" && (
          <button onClick={finish} className="btn-primary text-base py-3.5">
            Continuar
          </button>
        )}
      </div>
    </main>
  );
}

function ChoiceCard({
  onClick,
  icon,
  title,
  subtitle,
}: {
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-3xl border border-[color:var(--color-line)] hover:bg-[color:var(--color-surface)] transition-all card-interactive"
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
          className="text-[color:var(--color-ink-faint)] flex-shrink-0 mt-2"
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  subtitle,
  recommended,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left p-3 rounded-2xl border transition ${
        active
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-surface-2)]"
          : "border-[color:var(--color-line)] hover:bg-[color:var(--color-surface)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-4 h-4 rounded-full border-2 grid place-items-center flex-shrink-0 mt-0.5 ${
            active
              ? "border-[color:var(--color-accent)]"
              : "border-[color:var(--color-line-strong)]"
          }`}
        >
          {active && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-sm">{title}</p>
            {recommended && (
              <span className="text-[9px] uppercase tracking-wider font-bold text-[color:var(--color-accent)]">
                Recomendado
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--color-ink-soft)] mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>
    </button>
  );
}

function toMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { message?: string; issues?: Array<{ message: string }> } | null;
    if (body?.issues?.length) return body.issues.map((i) => i.message).join(" · ");
    if (body?.message) return body.message;
    return `Error ${e.status}`;
  }
  return e instanceof Error ? e.message : "Error inesperado";
}
