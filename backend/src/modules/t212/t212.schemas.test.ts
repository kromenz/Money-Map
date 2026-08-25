import { describe, it, expect } from "vitest";
import {
  accountSummarySchema,
  positionSchema,
  historicalOrderSchema,
  dividendSchema,
  cashTransactionSchema,
  parseItems,
} from "./t212.schemas";

const summary = {
  cash: { availableToTrade: 120.5, inPies: 0, reservedForOrders: 0 },
  currency: "EUR",
  id: 12345,
  investments: {
    currentValue: 5000,
    totalCost: 4200,
    realizedProfitLoss: 30,
    unrealizedProfitLoss: 800,
  },
  totalValue: 5120.5,
};

const position = {
  averagePricePaid: 92.3,
  createdAt: "2026-01-05T10:00:00Z",
  currentPrice: 101.2,
  instrument: { currency: "USD", isin: "US0378331005", name: "Apple", ticker: "AAPL_US_EQ" },
  quantity: 3.5,
  walletImpact: {
    currency: "EUR",
    currentValue: 354.2,
    fxImpact: -4.1,
    totalCost: 323.05,
    unrealizedProfitLoss: 31.15,
  },
};

describe("accountSummarySchema", () => {
  it("aceita a resposta do summary", () => {
    expect(accountSummarySchema.safeParse(summary).success).toBe(true);
  });

  it("ignora campos novos em vez de falhar -- a API esta em beta", () => {
    const r = accountSummarySchema.safeParse({ ...summary, campoNovo: 1 });
    expect(r.success).toBe(true);
  });

  it("recusa a resposta sem totalValue", () => {
    const { totalValue, ...sem } = summary;
    expect(accountSummarySchema.safeParse(sem).success).toBe(false);
  });
});

describe("positionSchema", () => {
  it("aceita uma posicao", () => {
    expect(positionSchema.safeParse(position).success).toBe(true);
  });

  it("aceita uma posicao sem walletImpact", () => {
    const { walletImpact, ...sem } = position;
    expect(positionSchema.safeParse(sem).success).toBe(true);
  });

  it("recusa uma posicao sem ticker -- sem ticker nao ha chave", () => {
    const semTicker = { ...position, instrument: { ...position.instrument, ticker: undefined } };
    expect(positionSchema.safeParse(semTicker).success).toBe(false);
  });
});

describe("historicalOrderSchema", () => {
  const item = {
    order: {
      id: 991,
      side: "BUY",
      status: "FILLED",
      ticker: "AAPL_US_EQ",
      type: "MARKET",
      initiatedFrom: "WEB",
    },
    fill: {
      id: 5501,
      filledAt: "2026-03-02T14:31:00Z",
      price: 88.1,
      quantity: 2,
      walletImpact: { currency: "EUR", fxRate: 1.08, netValue: -176.2, realisedProfitLoss: 0, taxes: [] },
    },
  };

  it("aceita uma execucao", () => {
    expect(historicalOrderSchema.safeParse(item).success).toBe(true);
  });

  it("aceita uma ordem sem execucao -- ha ordens canceladas no historico", () => {
    const { fill, ...sem } = item;
    expect(historicalOrderSchema.safeParse(sem).success).toBe(true);
  });

  it("recusa um side desconhecido", () => {
    const r = historicalOrderSchema.safeParse({ ...item, order: { ...item.order, side: "HOLD" } });
    expect(r.success).toBe(false);
  });
});

describe("cashTransactionSchema", () => {
  const item = { amount: 500, currency: "EUR", dateTime: "2026-04-01T09:00:00Z", reference: "d-1", type: "DEPOSIT" };

  it("aceita um deposito", () => {
    expect(cashTransactionSchema.safeParse(item).success).toBe(true);
  });

  it("recusa um tipo desconhecido em vez de o deixar passar", () => {
    // De proposito estrito: um movimento de tipo novo nao pode virar poupanca
    // por omissao. Falha, e o item e saltado e registado.
    expect(cashTransactionSchema.safeParse({ ...item, type: "CASHBACK" }).success).toBe(false);
  });
});

describe("dividendSchema", () => {
  it("aceita um dividendo com tipo desconhecido -- todos sao receita", () => {
    const r = dividendSchema.safeParse({
      amount: 1.42,
      amountInEuro: 1.31,
      currency: "USD",
      grossAmountPerShare: 0.24,
      paidOn: "2026-05-15T00:00:00Z",
      quantity: 5.9,
      reference: "div-77",
      ticker: "AAPL_US_EQ",
      type: "TIPO_NOVO",
    });
    expect(r.success).toBe(true);
  });
});

describe("parseItems", () => {
  it("separa os bons dos tortos e preserva a ordem", () => {
    const out = parseItems(cashTransactionSchema, [
      { amount: 1, currency: "EUR", dateTime: "2026-01-01T00:00:00Z", reference: "a", type: "DEPOSIT" },
      { amount: 2, currency: "EUR", dateTime: "2026-01-02T00:00:00Z", reference: "b", type: "MISTERIO" },
      { amount: 3, currency: "EUR", dateTime: "2026-01-03T00:00:00Z", reference: "c", type: "FEE" },
    ]);

    expect(out.items.map((i) => i.reference)).toEqual(["a", "c"]);
    expect(out.skipped).toHaveLength(1);
    expect(out.skipped[0].index).toBe(1);
    expect(out.skipped[0].message).toContain("type");
  });

  it("uma lista vazia nao e erro", () => {
    expect(parseItems(cashTransactionSchema, [])).toEqual({ items: [], skipped: [] });
  });
});
