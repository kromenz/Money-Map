import { describe, it, expect } from "vitest";
import { categoryDeltas } from "./category-deltas";
import type { GridResponse } from "../types/budget";

/** Um GridResponse com as linhas que interessam e sectionTotals coerentes. */
function grid(
  rows: { name: string; group: string; section: string; months: number[] }[]
): GridResponse {
  const total = (section: string) =>
    Array.from({ length: 12 }, (_, i) =>
      String(
        rows
          .filter((r) => r.section === section)
          .reduce((s, r) => s + r.months[i], 0)
      )
    );
  return {
    year: 2026,
    rows: rows.map((r, i) => ({
      categoryId: `c${i}`,
      section: r.section as "income" | "savings" | "expenses",
      group: r.group,
      name: r.name,
      months: r.months.map(String),
      total: "0",
    })),
    sectionTotals: [
      { section: "income", months: total("income"), total: "0" },
      { section: "expenses", months: total("expenses"), total: "0" },
      { section: "savings", months: total("savings"), total: "0" },
    ],
  };
}

const z = (...v: number[]) => [...v, ...Array(12 - v.length).fill(0)];

describe("categoryDeltas", () => {
  it("ordena pelo desvio ABSOLUTO, nao pelo desvio com sinal", () => {
    // Gastar 300 a menos do que o costume e tao digno de nota como gastar 200
    // a mais, e e o que explica um mes atipico.
    const data = grid([
      { name: "Rent", group: "Home", section: "expenses", months: z(500, 500, 200) },
      { name: "Food", group: "Home", section: "expenses", months: z(100, 100, 300) },
    ]);
    const d = categoryDeltas(data, 2);
    expect(d[0].name).toBe("Rent");
    expect(d[0].delta).toBeCloseTo(-200, 2);
    expect(d[1].name).toBe("Food");
    expect(d[1].delta).toBeCloseTo(133.33, 1);
  });

  it("uma categoria ausente num mes activo conta como zero na media", () => {
    // Nao se omite o mes: uma despesa que so aparece uma vez em tres meses tem
    // custo medio mensal baixo, e e essa a leitura correcta.
    const data = grid([
      { name: "Tax", group: "Home", section: "expenses", months: z(0, 0, 900) },
      { name: "Rent", group: "Home", section: "expenses", months: z(500, 500, 500) },
    ]);
    const tax = categoryDeltas(data, 2).find((c) => c.name === "Tax")!;
    expect(tax.average).toBeCloseTo(300, 2);
    expect(tax.delta).toBeCloseTo(600, 2);
  });

  it("uma categoria negativa mantem o sinal", () => {
    // Reembolso maior que o gasto. O valor liquido e a resposta certa.
    const data = grid([
      { name: "Travel", group: "Fun", section: "expenses", months: z(200, 200, -60) },
    ]);
    const t = categoryDeltas(data, 2)[0];
    expect(t.amount).toBeCloseTo(-60, 2);
    expect(t.delta).toBeLessThan(0);
  });

  it("a media usa os meses activos do ano, nao os doze", () => {
    // So dois meses com movimento: a media do Rent e 500, nao 83.33.
    const data = grid([
      { name: "Rent", group: "Home", section: "expenses", months: z(500, 500) },
    ]);
    expect(categoryDeltas(data, 0)[0].average).toBeCloseTo(500, 2);
  });

  it("so olha para as despesas", () => {
    // Receita e poupanca tem as suas proprias leituras nos KPIs.
    const data = grid([
      { name: "Salary", group: "", section: "income", months: z(2000, 2000) },
      { name: "Rent", group: "Home", section: "expenses", months: z(500, 700) },
    ]);
    const names = categoryDeltas(data, 1).map((c) => c.name);
    expect(names).toEqual(["Rent"]);
  });

  it("um ano sem meses activos devolve lista vazia em vez de rebentar", () => {
    const data = grid([
      { name: "Rent", group: "Home", section: "expenses", months: z() },
    ]);
    expect(categoryDeltas(data, 0)).toEqual([]);
  });
});
