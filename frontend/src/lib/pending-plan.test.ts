import { describe, it, expect } from "vitest";
import { groupPendingByYear } from "./pending-plan";
import type { PendingExpense } from "@/types/expense";

const row = (over: Partial<PendingExpense>): PendingExpense => ({
  id: "1",
  year: 2026,
  month: 8,
  section: "expenses",
  group: "Home",
  name: "Groceries",
  amount: "12.50",
  ...over,
});

describe("groupPendingByYear", () => {
  it("junta os do mesmo ano num so lote", () => {
    const batches = groupPendingByYear([
      row({ id: "a", amount: "10.00" }),
      row({ id: "b", amount: "2.50" }),
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0].ids).toEqual(["a", "b"]);
    expect(batches[0].expenses.map((e) => e.amount)).toEqual([10, 2.5]);
  });

  it("separa anos diferentes", () => {
    const batches = groupPendingByYear([
      row({ id: "a", year: 2025 }),
      row({ id: "b", year: 2026 }),
    ]);

    expect(batches.map((b) => b.year)).toEqual([2025, 2026]);
  });

  it("devolve os anos por ordem crescente", () => {
    const batches = groupPendingByYear([
      row({ id: "a", year: 2026 }),
      row({ id: "b", year: 2024 }),
      row({ id: "c", year: 2025 }),
    ]);

    expect(batches.map((b) => b.year)).toEqual([2024, 2025, 2026]);
  });

  it("mantem a ordem de chegada dentro do ano", () => {
    // A ordem muda a formula que fica na celula. Nao muda o total, mas o
    // historico dentro da folha e para ser lido.
    const batches = groupPendingByYear([
      row({ id: "a", amount: "1.00" }),
      row({ id: "b", amount: "2.00" }),
      row({ id: "c", amount: "3.00" }),
    ]);

    expect(batches[0].expenses.map((e) => e.amount)).toEqual([1, 2, 3]);
  });

  it("converte o valor de string para numero", () => {
    const batches = groupPendingByYear([row({ amount: "0.05" })]);
    expect(batches[0].expenses[0].amount).toBe(0.05);
  });

  it("uma fila vazia da uma lista vazia", () => {
    expect(groupPendingByYear([])).toEqual([]);
  });
});
