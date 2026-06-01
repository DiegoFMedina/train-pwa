"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Dish } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  dishes: Dish[];
}

const UNIT_SUGGESTIONS = ["g", "kg", "ml", "L", "un", "cda", "cdita", "taza", "pizca", "rebanada"];

export function DishesSheet({ open, onClose, dishes }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [prep, setPrep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setPrep("");
      setError(null);
      setExpanded(null);
    }
  }, [open]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dishes"] });
    qc.invalidateQueries({ queryKey: ["shopping-list"] });
    qc.invalidateQueries({ queryKey: ["dish-suggestions"] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      api.dishes.create({
        name: name.trim(),
        prep_minutes: prep ? Number(prep) : null,
      }),
    onSuccess: (created) => {
      invalidate();
      setName("");
      setPrep("");
      setError(null);
      setExpanded(created.id); // expandir el recién creado para que agregues ingredientes
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.dishes.remove(id),
    onSuccess: invalidate,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border-t border-[color:var(--color-line)] bg-[color:var(--color-bg)]/95 backdrop-blur-2xl px-5 pt-3 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[color:var(--color-line)]" />

        <header className="mb-5 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">Catálogo</p>
            <h2 className="title-display text-3xl">Mis platos</h2>
          </div>
          <button onClick={onClose} className="pill">
            Cerrar
          </button>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim()) {
              setError("Nombre requerido");
              return;
            }
            createMut.mutate();
          }}
          className="card mb-6 space-y-3"
        >
          <p className="eyebrow">Nuevo plato</p>
          <input
            className="input"
            placeholder="Nombre (ej: Pollo al curry)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="number"
              className="input mono"
              placeholder="Prep (min)"
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              min={0}
              max={1440}
            />
            <button
              type="submit"
              className="btn-primary !w-auto px-5"
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "…" : "Crear"}
            </button>
          </div>
          {error && <p className="text-sm text-[color:var(--color-down)]">{error}</p>}
        </form>

        <h3 className="text-sm font-semibold text-[color:var(--color-ink-soft)] mb-3">
          Tus platos ({dishes.length})
        </h3>
        {dishes.length === 0 ? (
          <div className="card text-center text-sm text-[color:var(--color-ink-faint)]">
            Sin platos aún. Crea el primero arriba.
          </div>
        ) : (
          <div className="space-y-2">
            {dishes.map((d) => (
              <DishCard
                key={d.id}
                dish={d}
                expanded={expanded === d.id}
                onToggle={() => setExpanded(expanded === d.id ? null : d.id)}
                onDelete={() => {
                  if (confirm(`¿Borrar "${d.name}"? (mantiene comidas planeadas sin plato)`)) {
                    removeMut.mutate(d.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DishCard({
  dish,
  expanded,
  onToggle,
  onDelete,
}: {
  dish: Dish;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const ingredients = useQuery({
    queryKey: ["dishes", dish.id, "ingredients"],
    queryFn: () => api.dishes.listIngredients(dish.id),
    enabled: expanded,
  });
  const [ingName, setIngName] = useState("");
  const [ingAmount, setIngAmount] = useState("");
  const [ingUnit, setIngUnit] = useState("g");

  const addMut = useMutation({
    mutationFn: () =>
      api.dishes.addIngredient(dish.id, {
        name: ingName.trim(),
        amount: ingAmount ? Number(ingAmount) : null,
        unit: ingUnit.trim() || null,
        quantity: null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes", dish.id, "ingredients"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      setIngName("");
      setIngAmount("");
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.dishes.removeIngredient(dish.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dishes", dish.id, "ingredients"] });
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
    },
  });

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-3 text-left"
        >
          <span
            className={`w-5 h-5 rounded-full grid place-items-center text-xs text-[color:var(--color-ink-soft)] transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
          <div className="min-w-0">
            <p className="font-medium truncate">{dish.name}</p>
            {dish.prep_minutes && (
              <p className="text-[10px] text-[color:var(--color-ink-faint)]">
                {dish.prep_minutes} min de prep
              </p>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-xs text-[color:var(--color-down)] px-2 py-1"
          aria-label={`Borrar ${dish.name}`}
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--color-line)] px-4 py-3 space-y-3">
          {ingredients.isLoading ? (
            <div className="h-12 animate-pulse bg-[color:var(--color-surface-2)] rounded-lg" />
          ) : (
            <>
              {(ingredients.data ?? []).length === 0 ? (
                <p className="text-xs text-[color:var(--color-ink-faint)] py-1">
                  Sin ingredientes — agrega abajo para que entren a la lista de compras.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {ingredients.data!.map((ing) => {
                    const display = ing.amount !== null && ing.amount !== undefined
                      ? `${formatNum(ing.amount)}${ing.unit ? " " + ing.unit : ""}`
                      : ing.quantity ?? "al gusto";
                    return (
                      <div key={ing.id} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-accent)]" />
                        <span className="flex-1 truncate">{ing.name}</span>
                        <span className="mono text-xs text-[color:var(--color-ink-soft)]">
                          {display}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMut.mutate(ing.id)}
                          className="text-xs text-[color:var(--color-down)] px-1"
                          aria-label={`Borrar ${ing.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ingName.trim()) addMut.mutate();
                }}
                className="space-y-1.5 pt-1"
              >
                <input
                  className="input !py-1.5 !text-xs"
                  placeholder="Ingrediente (ej: Pollo)"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                />
                <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                  <input
                    className="input !py-1.5 !text-xs mono"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="Cantidad"
                    value={ingAmount}
                    onChange={(e) => setIngAmount(e.target.value)}
                  />
                  <input
                    className="input !py-1.5 !text-xs mono"
                    list="ing-units"
                    placeholder="Unidad"
                    value={ingUnit}
                    onChange={(e) => setIngUnit(e.target.value)}
                  />
                  <datalist id="ing-units">
                    {UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                  <button
                    type="submit"
                    disabled={!ingName.trim() || addMut.isPending}
                    className="btn-primary !w-auto !py-1.5 !px-3 text-xs"
                  >
                    +
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(3))
    .toString()
    .replace(/\.?0+$/, "");
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
