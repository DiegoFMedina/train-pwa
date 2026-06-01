"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CoupleWithMembers } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function CoupleSection() {
  const couple = useQuery({
    queryKey: ["couples", "me"],
    queryFn: () => api.couples.me(),
  });

  if (couple.isLoading) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
          Pareja
        </h2>
        <div className="card h-24 animate-pulse" />
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
        Pareja
      </h2>
      {couple.data ? (
        <ActiveCoupleCard couple={couple.data} />
      ) : (
        <EmptyCoupleCard />
      )}
    </section>
  );
}

function EmptyCoupleCard() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Nuestra cuenta");
  const [mode, setMode] = useState<"separate" | "unified">("separate");
  const [code, setCode] = useState("");

  const createMut = useMutation({
    mutationFn: () => api.couples.create(name.trim() || "Nuestra cuenta", mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couples"] });
      setCreating(false);
      setError(null);
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const joinMut = useMutation({
    mutationFn: () => api.couples.join(code.trim().toUpperCase()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couples"] });
      setJoining(false);
      setError(null);
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  if (creating) {
    return (
      <div className="card space-y-4">
        <p className="eyebrow">Nueva pareja</p>
        <input
          className="input"
          placeholder="Nombre (ej: Casa con María)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
        />

        <div className="space-y-2">
          <p className="eyebrow">Cómo manejan las finanzas</p>
          <ModeCard
            active={mode === "separate"}
            onClick={() => setMode("separate")}
            title="Personal + compartido"
            subtitle="Cada uno mantiene sus finanzas privadas. Lo del hogar va a un pool aparte que ambos ven."
            recommended
          />
          <ModeCard
            active={mode === "unified"}
            onClick={() => setMode("unified")}
            title="Todo compartido"
            subtitle="Sin secretos. Ambos ven todos los ingresos y gastos. No hay zona personal."
          />
          <p className="text-[10px] text-[color:var(--color-ink-faint)] px-1">
            Podrás cambiarlo después sin perder datos.
          </p>
        </div>

        {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setError(null);
            }}
            className="btn-ghost flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={() => createMut.mutate()}
            className="btn-primary flex-1"
            disabled={createMut.isPending || !name.trim()}
          >
            {createMut.isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="card space-y-3">
        <p className="eyebrow">Unirme con código</p>
        <p className="text-xs text-[color:var(--color-ink-faint)]">
          Pídele a tu pareja que genere un código desde su perfil.
        </p>
        <input
          className="input mono uppercase tracking-widest text-center text-lg"
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          autoFocus
        />
        {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setJoining(false);
              setError(null);
            }}
            className="btn-ghost flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={() => joinMut.mutate()}
            className="btn-primary flex-1"
            disabled={joinMut.isPending || code.trim().length < 4}
          >
            {joinMut.isPending ? "Uniendo…" : "Unirme"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="text-sm font-medium mb-1">Aún no estás vinculado</p>
      <p className="text-xs text-[color:var(--color-ink-faint)] mb-4 leading-relaxed">
        Comparte finanzas, calendario de comidas y rutinas con tu pareja.
        Cada quien mantiene también su perfil personal.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => {
            setCreating(true);
            setError(null);
          }}
          className="btn-primary flex-1"
        >
          Crear pareja
        </button>
        <button
          onClick={() => {
            setJoining(true);
            setError(null);
          }}
          className="btn-tonal flex-1"
        >
          Tengo código
        </button>
      </div>
    </div>
  );
}

function ActiveCoupleCard({ couple }: { couple: CoupleWithMembers }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.id === couple.owner_id;
  const otherMember = couple.members.find((m) => m.user_id !== me?.id);
  const isFull = couple.members.length >= 2;

  const invitationsQ = useQuery({
    queryKey: ["couples", couple.id, "invitations"],
    queryFn: () => api.couples.listInvitations(couple.id),
    enabled: !isFull,
  });

  const [error, setError] = useState<string | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => api.couples.createInvitation(couple.id, 24),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couples", couple.id, "invitations"] });
      setError(null);
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const revokeMut = useMutation({
    mutationFn: (invitationId: string) => api.couples.revokeInvitation(invitationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couples", couple.id, "invitations"] }),
  });

  const updateModeMut = useMutation({
    mutationFn: (mode: "separate" | "unified") =>
      api.couples.update(couple.id, { mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["couples"] });
      // Forzar refetch de TODA la data scope-dependent porque el modo cambió
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["routines"] });
      qc.invalidateQueries({ queryKey: ["dishes"] });
      qc.invalidateQueries({ queryKey: ["meal-plans"] });
    },
  });

  const kickMut = useMutation({
    mutationFn: (userId: string) => api.couples.kick(couple.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couples"] }),
  });

  const leaveMut = useMutation({
    mutationFn: () => api.couples.leave(couple.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couples"] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.couples.remove(couple.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["couples"] }),
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code).catch(() => null);
  };

  return (
    <div className="space-y-3">
      {/* Card principal */}
      <div className="card-feature">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Pareja activa</p>
            <p
              className="text-2xl font-light truncate"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {couple.name}
            </p>
          </div>
          <span
            className="pill flex-shrink-0"
            style={{
              borderColor: "color-mix(in oklab, var(--color-jade) 35%, transparent)",
              color: "var(--color-jade)",
            }}
          >
            ● Vinculada
          </span>
        </div>

        <div className="space-y-2">
          {couple.members.map((m) => {
            const isMe = m.user_id === me?.id;
            const initial = m.user_name[0]?.toUpperCase() ?? "?";
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 py-1"
              >
                <span
                  className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-[#1a120a] flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
                    fontFamily: "var(--font-serif)",
                  }}
                >
                  {initial}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.user_name} {isMe && (
                      <span className="text-[10px] text-[color:var(--color-ink-faint)] ml-1">
                        (tú)
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[color:var(--color-ink-faint)] truncate">
                    {m.user_email}
                  </p>
                </div>
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{
                    color:
                      m.role === "owner"
                        ? "var(--color-accent)"
                        : "var(--color-ink-faint)",
                  }}
                >
                  {m.role === "owner" ? "Owner" : "Miembro"}
                </span>
                {isOwner && !isMe && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Expulsar a ${m.user_name}?`)) {
                        kickMut.mutate(m.user_id);
                      }
                    }}
                    className="text-xs text-[color:var(--color-down)] px-2 ml-1"
                    aria-label={`Expulsar a ${m.user_name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invitar — solo si no está llena */}
      {!isFull && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Invitar a tu pareja</p>
            <button
              onClick={() => inviteMut.mutate()}
              className="text-xs text-[color:var(--color-accent)] font-medium"
              disabled={inviteMut.isPending}
            >
              {inviteMut.isPending ? "…" : "Generar código"}
            </button>
          </div>
          {error && <p className="text-xs text-[color:var(--color-down)] mb-2">{error}</p>}

          {(invitationsQ.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-[color:var(--color-ink-faint)]">
              Genera un código de 8 caracteres y compártelo. Caduca en 24 horas.
            </p>
          ) : (
            <div className="space-y-1.5 mt-2">
              {invitationsQ.data!.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-[color:var(--color-surface-2)]"
                >
                  <span className="mono text-base font-bold tracking-widest text-[color:var(--color-accent)] flex-1">
                    {inv.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCode(inv.code)}
                    className="text-xs px-2 py-1 rounded-md text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-surface)]"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeMut.mutate(inv.id)}
                    className="text-xs px-2 py-1 rounded-md text-[color:var(--color-down)]"
                    aria-label="Revocar"
                    disabled={revokeMut.isPending}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modo financiero (solo el owner puede cambiar) */}
      {isOwner && (
        <div className="card space-y-3">
          <div>
            <p className="text-sm font-medium">Modo financiero</p>
            <p className="text-[10px] text-[color:var(--color-ink-faint)]">
              Cambiar no destruye datos. Solo afecta qué se ve en la app.
            </p>
          </div>
          <ModeCard
            active={couple.mode === "separate"}
            onClick={() => {
              if (couple.mode !== "separate") {
                if (
                  confirm(
                    "Cambiar a modo Personal + Compartido. Ambos volverán a tener su zona personal privada.",
                  )
                ) {
                  updateModeMut.mutate("separate");
                }
              }
            }}
            title="Personal + compartido"
            subtitle="Cada uno con sus finanzas privadas. Lo común va al pool del hogar."
          />
          <ModeCard
            active={couple.mode === "unified"}
            onClick={() => {
              if (couple.mode !== "unified") {
                if (
                  confirm(
                    "Cambiar a modo Todo compartido. La zona personal se ocultará — sus datos siguen guardados pero no se ven hasta volver al modo anterior.",
                  )
                ) {
                  updateModeMut.mutate("unified");
                }
              }
            }}
            title="Todo compartido"
            subtitle="Sin secretos. Ambos ven todos los ingresos y gastos."
          />
        </div>
      )}

      {/* Acciones de salida */}
      <div className="flex gap-2">
        {!isOwner && (
          <button
            onClick={() => {
              if (
                confirm(
                  `¿Dejar la pareja "${couple.name}"? Tus datos personales no se ven afectados.`,
                )
              ) {
                leaveMut.mutate();
              }
            }}
            className="btn-ghost flex-1"
          >
            Dejar pareja
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => {
              const text = otherMember
                ? `¿Borrar la pareja? ${otherMember.user_name} también perderá acceso.`
                : "¿Borrar la pareja?";
              if (confirm(text)) deleteMut.mutate();
            }}
            className="btn-ghost flex-1 !text-[color:var(--color-down)]"
          >
            Borrar pareja
          </button>
        )}
      </div>
    </div>
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
