import { describe, it, expect } from "vitest";
import { buildSnapshot, todayInLisbon } from "./t212.snapshot";

const summary = {
  currency: "EUR",
  cash: { availableToTrade: 120.5, inPies: 10, reservedForOrders: 5 },
  investments: { currentValue: 5000, totalCost: 4200, realizedProfitLoss: 30.5, unrealizedProfitLoss: 800 },
  totalValue: 5120.5,
};

describe("buildSnapshot", () => {
  it("mapeia o summary para a linha do dia", () => {
    expect(buildSnapshot("2026-08-25", summary)).toEqual({
      date: "2026-08-25",
      cash: "120.50",
      invested: "4200.00",
      marketValue: "5000.00",
      totalValue: "5120.50",
      realizedPl: "30.50",
      unrealizedPl: "800.00",
    });
  });

  it("o cash e so o disponivel para negociar", () => {
    // O inPies ja esta dentro do valor investido; somar os dois contava duas
    // vezes o mesmo dinheiro no valor total.
    expect(buildSnapshot("2026-08-25", summary).cash).toBe("120.50");
  });
});

describe("todayInLisbon", () => {
  it("usa o dia de Lisboa e nao o de UTC", () => {
    // 23:30 UTC em agosto ja e o dia seguinte em Lisboa (UTC+1).
    expect(todayInLisbon(new Date("2026-08-25T23:30:00Z"))).toBe("2026-08-26");
  });

  it("no inverno Lisboa esta em UTC", () => {
    expect(todayInLisbon(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });
});
