import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { diffCells, type DiffCell } from "./budget.diff";

const D = (n: string | number) => new Prisma.Decimal(n);

function cell(
  section: string,
  group: string,
  name: string,
  month: number,
  value: string | number
): DiffCell {
  return { section, group, name, month, value: D(value) };
}

describe("diffCells", () => {
  it("dois lados iguais nao produzem alteracoes", () => {
    const cells = [cell("expenses", "Home", "Rent", 1, 650)];
    const { summary, changes } = diffCells(cells, cells);

    expect(summary).toEqual({ changed: 0, added: 0, removed: 0, equal: 1 });
    expect(changes).toHaveLength(0);
  });

  it("apanha um valor que mudou", () => {
    const { summary, changes } = diffCells(
      [cell("expenses", "Home", "Rent", 3, 700)],
      [cell("expenses", "Home", "Rent", 3, 650)]
    );

    expect(summary.changed).toBe(1);
    expect(changes[0]).toEqual({
      scope: "expenses/Home",
      name: "Rent",
      month: 3,
      from: "650.00",
      to: "700.00",
      kind: "changed",
    });
  });

  it("apanha um valor novo e um que deixou de existir", () => {
    const { summary, changes } = diffCells(
      [cell("income", "", "Salary", 1, 1500)],
      [cell("expenses", "Home", "Rent", 1, 650)]
    );

    expect(summary).toEqual({ changed: 0, added: 1, removed: 1, equal: 0 });

    const added = changes.find((c) => c.kind === "added");
    expect(added).toEqual({
      scope: "income/",
      name: "Salary",
      month: 1,
      from: null,
      to: "1500.00",
      kind: "added",
    });

    const removed = changes.find((c) => c.kind === "removed");
    expect(removed).toMatchObject({ from: "650.00", to: null, kind: "removed" });
  });

  it("meio centimo de diferenca conta como igual", () => {
    const { summary } = diffCells(
      [cell("expenses", "Home", "Rent", 1, "650.004")],
      [cell("expenses", "Home", "Rent", 1, "650.000")]
    );

    expect(summary).toEqual({ changed: 0, added: 0, removed: 0, equal: 1 });
  });

  it("mais de meio centimo ja conta como alteracao", () => {
    const { summary } = diffCells(
      [cell("expenses", "Home", "Rent", 1, "650.006")],
      [cell("expenses", "Home", "Rent", 1, "650.000")]
    );

    expect(summary.changed).toBe(1);
  });

  it("a mesma categoria em meses diferentes sao celulas diferentes", () => {
    const { summary } = diffCells(
      [cell("expenses", "Home", "Rent", 1, 650), cell("expenses", "Home", "Rent", 2, 650)],
      [cell("expenses", "Home", "Rent", 1, 650)]
    );

    expect(summary).toEqual({ changed: 0, added: 1, removed: 0, equal: 1 });
  });

  it("categorias com o mesmo nome em grupos diferentes nao se confundem", () => {
    // "Other" existe como categoria em varios grupos. Se a chave nao incluir o
    // grupo, uma delas engole a outra.
    const { summary } = diffCells(
      [cell("expenses", "Home", "Other", 1, 10), cell("expenses", "Health", "Other", 1, 20)],
      [cell("expenses", "Home", "Other", 1, 10), cell("expenses", "Health", "Other", 1, 20)]
    );

    expect(summary.equal).toBe(2);
  });

  it("preserva valores negativos, que sao reembolsos netados", () => {
    const { changes } = diffCells(
      [cell("expenses", "Personal and Family", "Temu", 1, "-14.99")],
      []
    );

    expect(changes[0]).toMatchObject({ to: "-14.99", kind: "added" });
  });

  it("ordena as alteracoes de forma estavel", () => {
    const { changes } = diffCells(
      [
        cell("expenses", "Home", "Rent", 5, 1),
        cell("expenses", "Home", "Rent", 2, 1),
        cell("expenses", "Daily Living", "Groceries", 1, 1),
      ],
      []
    );

    expect(changes.map((c) => `${c.scope}/${c.name}#${c.month}`)).toEqual([
      "expenses/Daily Living/Groceries#1",
      "expenses/Home/Rent#2",
      "expenses/Home/Rent#5",
    ]);
  });
});
