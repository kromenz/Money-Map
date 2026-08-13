import { describe, expect, it } from "vitest";
import type { GridResponse, GridRow } from "../types/budget";
import { cumulativeSavings, yearGroups, yearTotals } from "./year-comparison";

/** 12 meses a partir de um mapa esparso indice -> valor. */
function months(values: Record<number, number>): string[] {
  return Array.from({ length: 12 }, (_, i) => (values[i] ?? 0).toFixed(2));
}

function grid(
  year: number,
  s: {
    income?: Record<number, number>;
    expenses?: Record<number, number>;
    savings?: Record<number, number>;
  },
  rows: GridRow[] = []
): GridResponse {
  const section = (name: string, m: Record<number, number>) => {
    const arr = months(m);
    return {
      section: name,
      months: arr,
      total: arr.reduce((a, v) => a + Number(v), 0).toFixed(2),
    };
  };
  return {
    year,
    rows,
    sectionTotals: [
      section("income", s.income ?? {}),
      section("expenses", s.expenses ?? {}),
      section("savings", s.savings ?? {}),
    ],
  };
}

function row(name: string, group: string, m: Record<number, number>): GridRow {
  const arr = months(m);
  return {
    categoryId: `${group}-${name}`,
    section: "expenses",
    group,
    name,
    months: arr,
    total: arr.reduce((a, v) => a + Number(v), 0).toFixed(2),
  };
}

describe("yearTotals", () => {
  it("soma cada seccao de cada ano", () => {
    const g = grid(2025, {
      income: { 0: 100, 1: 100 },
      expenses: { 0: 40 },
      savings: { 1: 30 },
    });
    expect(yearTotals([g])).toEqual([
      { year: 2025, income: 200, expenses: 40, savings: 30 },
    ]);
  });

  it("ordena por ano ascendente, seja qual for a ordem de entrada", () => {
    const anos = [grid(2026, {}), grid(2024, {}), grid(2025, {})];
    expect(yearTotals(anos).map((t) => t.year)).toEqual([2024, 2025, 2026]);
  });

  it("devolve lista vazia sem grelhas", () => {
    expect(yearTotals([])).toEqual([]);
  });
});

describe("cumulativeSavings", () => {
  it("acumula a poupanca ao longo dos meses", () => {
    const g = grid(2025, {
      income: { 0: 1, 1: 1, 2: 1 },
      savings: { 0: 10, 1: 20, 2: 5 },
    });
    const [serie] = cumulativeSavings([g]);
    expect(serie.points.slice(0, 3)).toEqual([10, 30, 35]);
  });

  it("para no ultimo mes com movimento em vez de desenhar uma linha plana", () => {
    // So Janeiro e Fevereiro aconteceram. De Marco a Dezembro nao ha meses --
    // repetir 30 ate Dezembro leria-se como dez meses sem poupar nada.
    const g = grid(2025, { income: { 0: 1, 1: 1 }, savings: { 0: 10, 1: 20 } });
    const [serie] = cumulativeSavings([g]);
    expect(serie.points).toEqual([10, 30, ...Array(10).fill(null)]);
  });

  it("um mes de poupanca zero no meio continua a contar como mes", () => {
    const g = grid(2025, {
      income: { 0: 1, 1: 1, 2: 1 },
      savings: { 0: 10, 2: 5 },
    });
    const [serie] = cumulativeSavings([g]);
    expect(serie.points.slice(0, 3)).toEqual([10, 10, 15]);
  });

  it("um ano sem movimento nenhum fica todo a null", () => {
    const [serie] = cumulativeSavings([grid(2025, {})]);
    expect(serie.points).toEqual(Array(12).fill(null));
  });

  it("acumula ate ao fim do ano sem nullar Dezembro", () => {
    const savingsData = {
      0: 10, 1: 20, 2: 15, 3: 25, 4: 30, 5: 12,
      6: 18, 7: 22, 8: 16, 9: 14, 10: 11, 11: 9
    };
    const g = grid(2025, { income: { 0: 1 }, savings: savingsData });
    const [serie] = cumulativeSavings([g]);
    const sum = Object.values(savingsData).reduce((a, b) => a + b, 0);
    expect(serie.points).not.toContain(null);
    expect(serie.points[11]).toBe(sum);
  });

  it("ordena por ano ascendente", () => {
    const series = cumulativeSavings([grid(2026, {}), grid(2024, {})]);
    expect(series.map((s) => s.year)).toEqual([2024, 2026]);
  });
});

describe("yearGroups", () => {
  it("soma cada categoria ao longo dos doze meses", () => {
    const g = grid(2025, {}, [
      row("Rent", "Home", { 0: 500, 1: 500 }),
      row("Power", "Home", { 0: 60 }),
      row("Fuel", "Car", { 0: 80 }),
    ]);
    expect(yearGroups(g)).toEqual([
      { group: "Home", amount: 1060 },
      { group: "Car", amount: 80 },
    ]);
  });

  it("chama Ungrouped ao grupo vazio", () => {
    const g = grid(2025, {}, [row("Odd", "", { 0: 10 })]);
    expect(yearGroups(g)[0].group).toBe("Ungrouped");
  });

  it("ignora linhas que nao sejam de despesa", () => {
    const salary: GridRow = {
      categoryId: "inc-1",
      section: "income",
      group: "Work",
      name: "Salary",
      months: months({ 0: 2000 }),
      total: "2000.00",
    };
    const g = grid(2025, {}, [salary, row("Fuel", "Car", { 0: 80 })]);
    expect(yearGroups(g)).toEqual([{ group: "Car", amount: 80 }]);
  });

  it("corta em seis entradas e o total continua a bater certo", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(`C${i}`, `G${i}`, { 0: (i + 1) * 10 })
    );
    const out = yearGroups(grid(2025, {}, rows));
    expect(out).toHaveLength(6);
    expect(out.reduce((s, g) => s + g.amount, 0)).toBe(360);
  });
});
