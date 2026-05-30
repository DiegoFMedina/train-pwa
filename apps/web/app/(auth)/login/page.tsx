"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r =
        mode === "login"
          ? await api.auth.login({ email, password })
          : await api.auth.register({ name, email, password });
      setAccessToken(r.tokens.access_token);
      setUser(r.user);
      router.replace("/hoy");
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as { message?: string; issues?: Array<{ message: string }> } | null;
        if (body?.issues?.length) {
          setError(body.issues.map((i) => i.message).join(" · "));
        } else if (body?.message) {
          setError(body.message);
        } else {
          setError(`Error ${e.status}`);
        }
      } else {
        setError("No se pudo conectar con el servidor");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="eyebrow mb-3">Tu control personal</p>
          <h1
            className="text-6xl leading-none font-light"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Mi<br />Centro
          </h1>
          <p className="mt-4 text-sm text-[color:var(--color-ink-soft)]">
            Finanzas, rutinas y dieta en un solo lugar. Ordenado. Tuyo.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-3">
          {mode === "register" && (
            <div>
              <label className="eyebrow block mb-1.5">Nombre</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                required
              />
            </div>
          )}
          <div>
            <label className="eyebrow block mb-1.5">Correo</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="eyebrow block mb-1.5">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-[color:var(--color-down)] py-1">{error}</p>
          )}

          <button className="btn-primary mt-2" type="submit" disabled={busy}>
            {busy ? "Espera…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="block w-full text-center text-sm text-[color:var(--color-ink-soft)] pt-3"
          >
            {mode === "login" ? (
              <>
                ¿Sin cuenta? <b className="text-[color:var(--color-accent)]">Crear una</b>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta? <b className="text-[color:var(--color-accent)]">Entra</b>
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
