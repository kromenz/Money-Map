import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkBatch, missingRowReason } from "./pending-check";
import type { YearBatch } from "./pending-plan";
import type { NewExpense } from "@/types/expense";
import { parseBudgetWorkbook } from "../../../backend/src/modules/budget/budget.parser";

const bytes = () =>
  new Uint8Array(
    readFileSync(path.resolve(__dirname, "__fixtures__/budget-2026.xlsx"))
  );

// Uma categoria que existe de facto na fixture, tirada do proprio parser para
// nao apodrecer se a fixture mudar.
async function realExpense(amount: number): Promise<NewExpense> {
  const parsed = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
  const c = parsed.categories.find((x) => x.section === "expenses");
  if (!c) throw new Error("a fixture nao tem nenhuma despesa");
  return { section: "expenses", group: c.group, name: c.name, month: 3, amount };
}

const ghost = (amount: number): NewExpense => ({
  section: "expenses",
  group: "Home",
  name: "Nao existe",
  month: 3,
  amount,
});

const batch = (ids: string[], expenses: NewExpense[]): YearBatch => ({
  year: 2026,
  ids,
  expenses,
});

describe("checkBatch", () => {
  it("deixa passar todas quando todas cabem", async () => {
    const good = await realExpense(10);
    const { ready, rejected } = await checkBatch(bytes(), batch(["a", "b"], [good, good]));

    expect(ready.ids).toEqual(["a", "b"]);
    expect(ready.expenses).toHaveLength(2);
    expect(rejected).toEqual([]);
  });

  it("tira so a que nao cabe, e as outras seguem", async () => {
    // A categoria foi renomeada na folha depois de o gasto entrar na fila.
    // Antes, isto prendia o ano inteiro.
    const good = await realExpense(10);
    const { ready, rejected } = await checkBatch(
      bytes(),
      batch(["a", "b", "c"], [good, ghost(5), good])
    );

    expect(ready.ids).toEqual(["a", "c"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].id).toBe("b");
    expect(rejected[0].reason).toContain("Nao existe");
    expect(rejected[0].reason).toContain("2026");
  });

  it("mantem a ordem de chegada nas que ficam", async () => {
    // A ordem e a formula que fica na celula.
    const { ready } = await checkBatch(
      bytes(),
      batch(
        ["a", "b", "c", "d"],
        [await realExpense(1), ghost(2), await realExpense(3), await realExpense(4)]
      )
    );

    expect(ready.expenses.map((e) => e.amount)).toEqual([1, 3, 4]);
    expect(ready.ids).toEqual(["a", "c", "d"]);
  });

  it("todas rejeitadas da um lote pronto vazio", async () => {
    // O route usa isto para nem reescrever o ficheiro.
    const { ready, rejected } = await checkBatch(
      bytes(),
      batch(["a", "b"], [ghost(1), ghost(2)])
    );

    expect(ready.ids).toEqual([]);
    expect(ready.expenses).toEqual([]);
    expect(ready.year).toBe(2026);
    expect(rejected.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("um ficheiro que nao e um xlsx falha o lote, nao cada entrada", async () => {
    // Um defeito do ficheiro nao e um defeito da entrada. Transforma-lo em N
    // rejeitadas levava o utilizador a descartar gastos bons.
    const garbage = new TextEncoder().encode("isto nao e um zip");
    await expect(
      checkBatch(garbage, batch(["a"], [await realExpense(1)]))
    ).rejects.toThrow();
  });

  it("um lote vazio da um lote vazio", async () => {
    const { ready, rejected } = await checkBatch(bytes(), batch([], []));
    expect(ready.ids).toEqual([]);
    expect(rejected).toEqual([]);
  });
});

describe("missingRowReason", () => {
  it("diz o grupo quando ha um", () => {
    expect(
      missingRowReason(2026, { section: "expenses", group: "Home", name: "Gas" })
    ).toBe('the 2026 sheet has no "Gas" row under expenses › Home');
  });

  it("so a seccao quando a categoria nao tem grupo", () => {
    expect(
      missingRowReason(2026, { section: "income", group: "", name: "Bonus" })
    ).toBe('the 2026 sheet has no "Bonus" row under income');
  });
});
