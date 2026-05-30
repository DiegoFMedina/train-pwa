"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Category } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}

interface FormState {
  id: string | null;
  name: string;
  kind: "income" | "expense";
}

const empty: FormState = { id: null, name: "", kind: "expense" };

export function CategoriesSheet({ open, onClose, categories }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(empty);
      setError(null);
    }
  }, [open]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (form.id) {
        return api.categories.update(form.id, { name: form.name, kind: form.kind });
      }
      return api.categories.create({ name: form.name, kind: form.kind });
    },
    onSuccess: () => {
      invalidate();
      setForm(empty);
      setError(null);
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.categories.remove(id),
    onSuccess: invalidate,
    onError: (e: unknown) => setError(toMessage(e)),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)] px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[color:var(--color-line)]" />

        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">Configurar</p>
            <h2 className="text-2xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
              Categorías
            </h2>
          </div>
          <button onClick={onClose} className="pill">
            Cerrar
          </button>
        </header>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (form.name.trim().length < 1) {
              setError("Nombre requerido");
              return;
            }
            saveMutation.mutate();
          }}
          className="card mb-6 space-y-3"
        >
          <p className="eyebrow">
            {form.id ? "Editando categoría" : "Nueva categoría"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "expense" }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                form.kind === "expense"
                  ? "bg-[color:var(--color-down)] text-[#1a120a]"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, kind: "income" }))}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                form.kind === "income"
                  ? "bg-[color:var(--color-up)] text-[#0a1a12]"
                  : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
              }`}
            >
              Ingreso
            </button>
          </div>

          <input
            className="input"
            placeholder="Nombre (ej: Sueldo, Comida)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={80}
            autoFocus
          />

          {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}

          <div className="flex gap-2">
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(empty)}
                className="flex-1 py-3 rounded-xl bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-sm font-medium"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? "Guardando…"
                : form.id
                  ? "Actualizar"
                  : "Crear"}
            </button>
          </div>
        </form>

        {/* List */}
        <h3 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
          Tus categorías ({categories.length})
        </h3>
        {categories.length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin categorías aún. Crea la primera arriba.
          </div>
        ) : (
          <div className="card space-y-1">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 py-1.5 group"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background:
                      c.kind === "income"
                        ? "var(--color-up)"
                        : "var(--color-down)",
                  }}
                />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[10px] text-[color:var(--color-ink-faint)] mr-1">
                  {c.kind === "income" ? "ingreso" : "gasto"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ id: c.id, name: c.name, kind: c.kind })
                  }
                  className="text-xs px-2 py-1 rounded-md text-[color:var(--color-accent)] hover:bg-[color:var(--color-surface-2)]"
                  aria-label={`Editar ${c.name}`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Borrar "${c.name}"?`)) {
                      removeMutation.mutate(c.id);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-md text-[color:var(--color-down)] hover:bg-[color:var(--color-surface-2)]"
                  aria-label={`Borrar ${c.name}`}
                  disabled={removeMutation.isPending}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
