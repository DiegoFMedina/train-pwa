"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Category } from "@mi-centro/shared";
import { api } from "@/lib/api";

export function NewTransactionForm({ categories }: { categories: Category[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.transactions.create({
        kind,
        amount: Number(amount),
        currency: "CLP",
        category_id: categoryId || undefined,
        description: description || undefined,
        occurred_on: occurredOn,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      setAmount("");
      setDescription("");
      setCategoryId("");
      setOpen(false);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : "Error inesperado");
    },
  });

  const filteredCats = categories.filter((c) => c.kind === kind);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary"
      >
        + Nuevo movimiento
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!amount || Number(amount) <= 0) {
          setError("Ingresa un monto válido");
          return;
        }
        mutation.mutate();
      }}
      className="card space-y-3"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            kind === "expense"
              ? "bg-[color:var(--color-down)] text-[#1a120a]"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
            kind === "income"
              ? "bg-[color:var(--color-up)] text-[#0a1a12]"
              : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Ingreso
        </button>
      </div>

      <div>
        <label className="eyebrow block mb-1.5">Monto</label>
        <input
          className="input mono text-2xl"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="eyebrow block mb-1.5">Descripción</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Almuerzo, sueldo, etc."
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="eyebrow block mb-1.5">Categoría</label>
          <select
            className="input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sin categoría</option>
            {filteredCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Fecha</label>
          <input
            className="input"
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-[color:var(--color-down)]">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="flex-1 py-3 rounded-xl bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)] text-sm font-medium"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
