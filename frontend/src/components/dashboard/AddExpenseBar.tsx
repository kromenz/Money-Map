"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MONTH_LABELS } from "@/lib/format";
import { addExpense } from "@/services/expense.service";
import type { GridRow } from "@/types/budget";

/**
 * Registar um gasto sem abrir o Excel.
 *
 * As categorias saem da grelha que ja esta carregada -- nenhum pedido novo. So
 * as de despesa: o mecanismo serve as tres seccoes, mas foi so o que se pediu.
 */
export function AddExpenseBar({
  year,
  rows,
  onWritten,
  onPending,
}: {
  year: number;
  rows: GridRow[];
  onWritten: () => void;
  onPending: (count: number) => void;
}) {
  const categories = rows.filter((r) => r.section === "expenses");

  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) return null;

  const value = Number(amount.replace(",", "."));
  const ready = categoryId !== "" && value > 0 && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = categories.find((c) => c.categoryId === categoryId);
    if (!category || !(value > 0)) return;

    setBusy(true);
    setError(null);
    try {
      const result = await addExpense({
        year,
        month,
        section: "expenses",
        group: category.group,
        name: category.name,
        amount: value,
      });

      if (result.status === "written") {
        setAmount("");
        onWritten();
      } else if (result.status === "pending") {
        setAmount("");
        onPending(result.count);
      } else {
        setError(result.reason);
      }
    } catch {
      setError("the expense could not be saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <select
        aria-label="Category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="h-9 min-w-48 rounded-md border bg-transparent px-3 text-sm">
        <option value="">Category…</option>
        {categories.map((c) => (
          <option key={c.categoryId} value={c.categoryId}>
            {c.group === "" ? c.name : `${c.group} · ${c.name}`}
          </option>
        ))}
      </select>

      <Input
        aria-label="Amount"
        inputMode="decimal"
        placeholder="12,50"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-28"
      />

      <select
        aria-label="Month"
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="h-9 rounded-md border bg-transparent px-3 text-sm">
        {MONTH_LABELS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </select>

      <Button type="submit" disabled={!ready}>
        {busy ? "Adding…" : "Add expense"}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
