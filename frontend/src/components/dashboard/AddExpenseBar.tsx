"use client";

import { useState } from "react";
import { CalendarIcon, PlusIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_LABELS } from "@/lib/format";
import { addExpense } from "@/services/expense.service";
import type { GridRow } from "@/types/budget";

/**
 * Registar um gasto sem abrir o Excel.
 *
 * As categorias saem da grelha que ja esta carregada -- nenhum pedido novo. So
 * as de despesa: o mecanismo serve as tres seccoes, mas foi so o que se pediu.
 *
 * Os dois campos de escolha sao o <Select> da casa e nao <select> nativos. O
 * nativo deixa a lista ao sistema operativo, que a desenha com as cores dele --
 * no tema escuro abria um painel branco no meio de uma pagina escura. O da casa
 * usa os tokens --popover e acompanha o tema.
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

  // null e nao "": e assim que o <Select.Value> sabe que ainda nao ha escolha e
  // mostra o placeholder em vez de uma linha vazia.
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.length === 0) return null;

  // O `items` do Select serve so para o botao saber que texto mostrar depois de
  // escolhido -- sem isto o gatilho imprimia o categoryId cru.
  const categoryItems = categories.map((c) => ({
    value: c.categoryId,
    label: c.group === "" ? c.name : `${c.group} · ${c.name}`,
  }));
  const monthItems = MONTH_LABELS.map((label, i) => ({ value: i + 1, label }));

  const normalizedAmount = amount.replace(",", ".");
  const value = Number(normalizedAmount);
  // Mais de duas casas decimais: a rota arredonda antes de escrever, mas
  // arredondar em silencio aqui deixava o utilizador sem saber que o valor
  // digitado nao e o que vai ficar na folha. Recusa-se em vez de arredondar.
  const tooManyDecimals = /\.\d{3,}/.test(normalizedAmount);
  const ready = categoryId !== null && value > 0 && !tooManyDecimals && !busy;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = categories.find((c) => c.categoryId === categoryId);
    if (!category || !(value > 0) || tooManyDecimals) return;

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
      className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <Select
        items={categoryItems}
        value={categoryId}
        onValueChange={(v) => setCategoryId(v)}>
        {/* data-[size=default]:h-10 e nao h-10: a altura do gatilho vem de uma
            regra com data-attribute, que ganha a uma classe simples. Um h-10 a
            seco era ignorado e o campo ficava 8px mais baixo do que o valor e o
            botao ao lado. */}
        <SelectTrigger
          aria-label="Category"
          className="min-w-56 px-3 data-[size=default]:h-10">
          <TagIcon className="text-muted-foreground" />
          <SelectValue placeholder="Category…" />
        </SelectTrigger>
        <SelectContent>
          {categoryItems.map((c) => (
            <SelectItem key={c.value} value={c.value} className="py-1.5">
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-1">
        <div className="relative">
          {/* O simbolo dentro do campo e nao ao lado: o valor e o unico numero
              da barra e sem ele lia-se como uma quantidade qualquer. */}
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            €
          </span>
          <Input
            aria-label="Amount"
            inputMode="decimal"
            placeholder="12,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-32 pl-7 tabular-nums"
          />
        </div>
        {tooManyDecimals && (
          <p className="text-xs text-destructive">Use at most two decimal places</p>
        )}
      </div>

      <Select
        items={monthItems}
        value={month}
        onValueChange={(v) => {
          if (v !== null) setMonth(v);
        }}>
        <SelectTrigger
          aria-label="Month"
          className="min-w-28 px-3 data-[size=default]:h-10">
          <CalendarIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthItems.map((m) => (
            <SelectItem key={m.value} value={m.value} className="py-1.5">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" size="lg" disabled={!ready} className="h-10 px-4">
        <PlusIcon />
        {busy ? "Adding…" : "Add expense"}
      </Button>

      {error && (
        <p role="alert" className="self-center text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
