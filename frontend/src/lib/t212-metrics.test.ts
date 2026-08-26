import { describe, it, expect } from "vitest";
import { chartData, dividendsByMonth, withWeights } from "./t212-metrics";

const holding = (ticker: string, currentValue: string) => ({
  ticker,
  name: ticker,
  currency: "EUR",
  quantity: "1.00000000",
  averagePricePaid: "10.00000000",
  currentPrice: "12.00000000",
  currentValue,
  totalCost: "10.00",
  unrealizedPl: "2.00",
  fxImpact: "0.00",
});

describe("withWeights", () => {
  it("o peso e a fatia do valor total", () => {
    const rows = withWeights([holding("A", "75.00"), holding("B", "25.00")]);
    expect(rows[0].weight).toBeCloseTo(0.75);
    expect(rows[1].weight).toBeCloseTo(0.25);
  });

  it("uma carteira sem valor nao divide por zero", () => {
    const rows = withWeights([holding("A", "0.00")]);
    expect(rows[0].weight).toBeNull();
  });
});

describe("chartData", () => {
  it("converte para numero e preserva os nulos", () => {
    const out = chartData([
      { date: "2026-01-05", invested: "100.00", marketValue: "105.00" },
      { date: "2026-01-06", invested: "100.00", marketValue: null },
    ]);

    expect(out[0]).toEqual({ date: "2026-01-05", invested: 100, marketValue: 105 });
    // Nulo e nao zero: e o que faz o recharts desenhar a lacuna em vez de uma
    // queda a pique ate ao eixo.
    expect(out[1].marketValue).toBeNull();
  });
});

describe("dividendsByMonth", () => {
  const item = (paidOn: string, amountInEuro: string) => ({
    externalId: paidOn,
    paidOn,
    ticker: "A",
    quantity: "1.00000000",
    amount: amountInEuro,
    currency: "EUR",
    amountInEuro,
    type: "ORDINARY",
  });

  it("devolve sempre doze meses, mesmo os vazios", () => {
    expect(dividendsByMonth([], 2026)).toHaveLength(12);
  });

  it("soma os pagamentos do mes", () => {
    const out = dividendsByMonth([item("2026-05-02", "1.50"), item("2026-05-20", "2.50")], 2026);
    expect(out[4].total).toBeCloseTo(4);
  });

  it("ignora pagamentos de outro ano", () => {
    const out = dividendsByMonth([item("2025-05-02", "1.50")], 2026);
    expect(out.every((m) => m.total === 0)).toBe(true);
  });
});
