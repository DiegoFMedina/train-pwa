"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Category, Transaction } from "@mi-centro/shared";
import { ApiError, api } from "@/lib/api";
import { shortDate, signedMoney } from "@/lib/format";

interface Props {
  tx: Transaction;
  category: Category | null;
}

export function TransactionItem({ tx, category }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <EditForm tx={tx} onDone={() => setEditing(false)} />;
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full flex items-center gap-3 py-2 text-left rounded-lg hover:bg-[color:var(--color-surface-2)] transition-colors"
    >
      <span
        className="w-9 h-9 rounded-full grid place-items-center text-base flex-shrink-0"
        style={{
          background: "var(--color-surface-2)",
          color:
            tx.kind === "income"
              ? "var(--color-up)"
              : "var(--color-down)",
        }}
      >
        {tx.kind === "income" ? "↑" : "↓"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {tx.description ?? category?.name ?? "—"}
        </p>
        <p className="text-xs text-[color:var(--color-ink-faint)]">
          {category?.name ?? "Sin categoría"} · {shortDate(tx.occurred_on)}
        </p>
      </div>
      <p
        className={`mono text-sm font-medium ${
          tx.kind === "income"
            ? "text-[color:var(--color-up)]"
            : "text-[color:var(--color-down)]"
        }`}
      >
        {signedMoney(tx.amount, tx.kind, tx.currency)}
      </p>
    </button>
  );
}

function EditForm({ tx, onDone }: { tx: Transaction; onDone: () => void }) {
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const [kind, setKind] = useState<"expense" | "income">(tx.kind);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? "");
  const [categoryId, setCategoryId] = useState<string>(tx.category_id ?? "");
  const [occurredOn, setOccurredOn] = useState(tx.occurred_on);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
  };

  const updateMut = useMutation({
    mutationFn: () =>
      api.transactions.update(tx.id, {
        kind,
        amount: Number(amount),
        category_id: categoryId || null,
        description: description || null,
        occurred_on: occurredOn,
      }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.transactions.remove(tx.id),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (e: unknown) => setError(toMessage(e)),
  });

  const filteredCats = (cats.data ?? []).filter((c) => c.kind === kind);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!amount || Number(amount) <= 0) {
          setError("Monto inválido");
          return;
        }
        updateMut.mutate();
      }}
      className="my-1 -mx-1 px-3 py-3 rounded-xl bg-[color:var(--color-surface-2)] space-y-3"
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
            kind === "expense"
              ? "bg-[color:var(--color-down)] text-[#1a120a]"
              : "bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition ${
            kind === "income"
              ? "bg-[color:var(--color-up)] text-[#0a1a12]"
              : "bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
          }`}
        >
          Ingreso
        </button>
      </div>

      <input
        type="number"
        inputMode="decimal"
        className="input mono"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Monto"
      />

      <input
        className="input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción"
      />

      <div className="grid grid-cols-2 gap-2">
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
        <input
          type="date"
          className="input"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-[color:var(--color-down)]">{error}</p>}

      <div className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => {
            if (confirm("¿Borrar este movimiento?")) deleteMut.mutate();
          }}
          className="px-3 py-2 rounded-lg text-xs text-[color:var(--color-down)] hover:bg-[color:var(--color-surface)]"
          disabled={deleteMut.isPending}
        >
          Borrar
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDone}
          className="px-3 py-2 rounded-lg text-xs text-[color:var(--color-ink-soft)]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn-primary !w-auto !py-2 !px-4 text-xs"
          disabled={updateMut.isPending}
        >
          {updateMut.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
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
