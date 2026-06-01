"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { UpdateUserPreferences } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { CoupleSection } from "./couple-section";

export default function PerfilPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);

  const [language, setLanguage] = useState<"es" | "en">("es");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [timezone, setTimezone] = useState("America/Santiago");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLanguage(user.language);
    setTheme(user.theme);
    setTimezone(user.timezone);
    setQuietStart(user.quiet_hours_start ?? "");
    setQuietEnd(user.quiet_hours_end ?? "");
  }, [user]);

  const saveMut = useMutation({
    mutationFn: (input: UpdateUserPreferences) => api.me.patch(input),
    onSuccess: (updated) => {
      setUser(updated);
      setSaved(true);
      setError(null);
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        const body = e.body as { message?: string; issues?: Array<{ message: string }> } | null;
        setError(body?.issues?.map((i) => i.message).join(" · ") ?? body?.message ?? `Error ${e.status}`);
      } else {
        setError("Error inesperado");
      }
    },
  });

  if (!user) return null;
  const initial = (user.name[0] ?? "?").toUpperCase();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32">
      <header className="mb-7">
        <p className="eyebrow mb-1.5">Tu cuenta</p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          Perfil
        </h1>
      </header>

      {/* Tarjeta de identidad */}
      <section className="card mb-6 flex items-center gap-4">
        <span
          className="w-14 h-14 rounded-full grid place-items-center text-2xl font-bold text-[#1a120a] flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
            fontFamily: "var(--font-serif)",
          }}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{user.name}</p>
          <p className="text-xs text-[color:var(--color-ink-faint)] truncate">
            {user.email}
          </p>
        </div>
      </section>

      {/* Preferencias */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          saveMut.mutate({
            language,
            theme,
            timezone,
            quiet_hours_start: quietStart || null,
            quiet_hours_end: quietEnd || null,
          });
        }}
        className="space-y-5"
      >
        <section>
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
            Preferencias
          </h2>
          <div className="card space-y-4">
            <div>
              <label className="eyebrow block mb-2">Idioma</label>
              <div className="flex gap-2">
                {(["es", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguage(l)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                      language === l
                        ? "bg-[color:var(--color-accent)] text-[#1a120a]"
                        : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                    }`}
                  >
                    {l === "es" ? "Español" : "English"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="eyebrow block mb-2">Tema</label>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`py-2 rounded-xl text-xs font-medium transition ${
                      theme === t
                        ? "bg-[color:var(--color-accent)] text-[#1a120a]"
                        : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                    }`}
                  >
                    {t === "light" ? "Claro" : t === "dark" ? "Oscuro" : "Sistema"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[color:var(--color-ink-faint)] mt-2">
                Solo Oscuro está implementado por ahora.
              </p>
            </div>

            <div>
              <label className="eyebrow block mb-2">Zona horaria</label>
              <input
                className="input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/Santiago"
              />
              <p className="text-[10px] text-[color:var(--color-ink-faint)] mt-1">
                IANA, ej: America/Santiago, Europe/Madrid
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
            Horas de silencio
          </h2>
          <div className="card">
            <p className="text-xs text-[color:var(--color-ink-faint)] mb-3">
              Las notificaciones no se dispararán en este rango.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="eyebrow block mb-1.5">Desde</label>
                <input
                  type="time"
                  className="input mono"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                />
              </div>
              <div>
                <label className="eyebrow block mb-1.5">Hasta</label>
                <input
                  type="time"
                  className="input mono"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-[color:var(--color-down)] px-2">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-[color:var(--color-up)] px-2">
            ✓ Preferencias guardadas
          </p>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? "Guardando…" : "Guardar preferencias"}
        </button>
      </form>

      {/* Sesión */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
          Sesión
        </h2>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("¿Cerrar sesión en este dispositivo?")) return;
            await api.auth.logout().catch(() => null);
            clear();
            qc.clear();
            router.replace("/login");
          }}
          className="w-full py-3 rounded-xl border border-[color:var(--color-line)] text-[color:var(--color-down)] text-sm font-medium hover:bg-[color:var(--color-surface-2)] transition"
        >
          Cerrar sesión
        </button>
      </section>

      <CoupleSection />
    </main>
  );
}
