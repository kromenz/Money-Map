import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toHoldingViews, toStatusViews } from "./t212.view";

const d = (v: string) => new Prisma.Decimal(v);

const holding = (ticker: string, currentValue: string) => ({
  ticker,
  name: ticker,
  currency: "EUR",
  quantity: d("1.5"),
  averagePricePaid: d("10"),
  currentPrice: d("12"),
  currentValue: d(currentValue),
  totalCost: d("15"),
  unrealizedPl: d("3"),
  fxImpact: d("0"),
});

describe("toHoldingViews", () => {
  it("dinheiro sai em string com duas casas -- Decimal nao sobrevive ao JSON", () => {
    const [view] = toHoldingViews([holding("A", "18")]);

    expect(view.currentValue).toBe("18.00");
    expect(view.quantity).toBe("1.50000000");
    expect(typeof view.unrealizedPl).toBe("string");
  });

  it("ordena por valor, do maior para o menor", () => {
    const views = toHoldingViews([holding("A", "10"), holding("B", "50"), holding("C", "30")]);
    expect(views.map((v) => v.ticker)).toEqual(["B", "C", "A"]);
  });

  it("uma carteira vazia nao rebenta", () => {
    expect(toHoldingViews([])).toEqual([]);
  });
});

describe("toStatusViews", () => {
  it("expoe a data e o erro de cada etapa", () => {
    const views = toStatusViews([
      { kind: "orders", lastRunAt: new Date("2026-08-25T10:00:00Z"), lastError: null, lastSkipped: 0 },
      { kind: "dividends", lastRunAt: new Date("2026-08-25T10:00:00Z"), lastError: "429", lastSkipped: 0 },
    ]);

    expect(views[0]).toEqual({
      kind: "orders",
      lastRunAt: "2026-08-25T10:00:00.000Z",
      lastError: null,
      lastSkipped: 0,
    });
    expect(views[1].lastError).toBe("429");
  });

  it("uma etapa que nunca correu tem data nula", () => {
    expect(
      toStatusViews([{ kind: "summary", lastRunAt: null, lastError: null, lastSkipped: 0 }])[0].lastRunAt
    ).toBeNull();
  });

  it("expoe quantos itens a ultima corrida saltou -- e o numero que ficava preso no StageReport", () => {
    const views = toStatusViews([
      { kind: "positions", lastRunAt: new Date("2026-08-25T10:00:00Z"), lastError: null, lastSkipped: 7 },
    ]);

    expect(views[0].lastSkipped).toBe(7);
  });
});
