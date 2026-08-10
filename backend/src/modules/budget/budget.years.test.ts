import { describe, it, expect } from "vitest";
import { normaliseYearRows } from "./budget.years";

describe("normaliseYearRows", () => {
  it("converte contagens em BigInt para number", () => {
    // count(*) em Postgres e bigint. Se passar assim para o res.json(), o
    // Express rebenta com "Do not know how to serialize a BigInt".
    const out = normaliseYearRows([{ year: 2026, transactions: 133n }]);

    expect(out).toEqual([{ year: 2026, transactions: 133 }]);
    expect(typeof out[0].transactions).toBe("number");
  });

  it("aceita contagens que ja venham como number", () => {
    expect(normaliseYearRows([{ year: 2026, transactions: 133 }])).toEqual([
      { year: 2026, transactions: 133 },
    ]);
  });

  it("ordena por ano crescente", () => {
    const out = normaliseYearRows([
      { year: 2026, transactions: 1 },
      { year: 2024, transactions: 1 },
      { year: 2025, transactions: 1 },
    ]);

    expect(out.map((y) => y.year)).toEqual([2024, 2025, 2026]);
  });

  it("sem linhas devolve lista vazia", () => {
    expect(normaliseYearRows([])).toEqual([]);
  });
});
