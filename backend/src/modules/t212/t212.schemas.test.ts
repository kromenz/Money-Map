import { describe, it, expect } from "vitest";
import {
  accountSummarySchema,
  positionSchema,
  historicalOrderSchema,
  dividendSchema,
  cashTransactionSchema,
  parseItems,
} from "./t212.schemas";
import { toHoldingRows, toOrderRows, toDividendRows } from "./t212.map";

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

describe("campos numericos que a API manda a null em vez de omitir", () => {
  // Payload real de uma posicao num ETF em euros: a T212 manda fxImpact:null
  // sempre que a moeda do instrumento e da conta coincidem. `.default()` do
  // Zod so dispara em undefined, nao em null -- o walletImpact inteiro falhava
  // e a posicao desaparecia. Numa conta real isto tirou 7 ETFs (~107 EUR) de
  // 72 posicoes, com a etapa a reportar ok:true.
  const etfEmEuros = {
    instrument: {
      ticker: "SMHm_EQ",
      name: "VanEck Semiconductor (Acc)",
      isin: "IE00BMC38736",
      currency: "EUR",
    },
    quantity: 0.15168716,
    currentPrice: 89.09,
    averagePricePaid: 95.13000309,
    walletImpact: {
      currency: "EUR",
      totalCost: 14.43,
      currentValue: 13.51,
      unrealizedProfitLoss: -0.92,
      fxImpact: null,
    },
  };

  it("positionSchema aceita fxImpact:null e mapeia para impacto cambial zero", () => {
    const parsed = positionSchema.safeParse(etfEmEuros);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const [row] = toHoldingRows([parsed.data]);
    expect(row.fxImpact).toBe("0.00");
    expect(row.currentValue).toBe("13.51");
  });

  it("positionSchema continua a recusar uma posicao a que falte o ticker", () => {
    const semTicker = {
      ...etfEmEuros,
      instrument: { ...etfEmEuros.instrument, ticker: undefined },
    };
    expect(positionSchema.safeParse(semTicker).success).toBe(false);
  });

  it("positionSchema aceita null nos outros numeros por omissao do walletImpact e do currentPrice", () => {
    const tudoNulo = {
      ...etfEmEuros,
      currentPrice: null,
      walletImpact: {
        currency: "EUR",
        totalCost: null,
        currentValue: null,
        unrealizedProfitLoss: null,
        fxImpact: null,
      },
    };
    const parsed = positionSchema.safeParse(tudoNulo);
    expect(parsed.success).toBe(true);
  });

  it("accountSummarySchema aceita null nos campos com omissao de cash e investments", () => {
    const parsed = accountSummarySchema.safeParse({
      currency: "EUR",
      cash: { availableToTrade: 120.5, inPies: null, reservedForOrders: null },
      investments: {
        currentValue: 5000,
        totalCost: 4200,
        realizedProfitLoss: null,
        unrealizedProfitLoss: null,
      },
      totalValue: 5120.5,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.cash.inPies).toBe(0);
    expect(parsed.data.investments.realizedProfitLoss).toBe(0);
  });

  it("historicalOrderSchema aceita fxRate:null e realisedProfitLoss:null sem saltar a execucao", () => {
    const item = {
      order: { id: 991, ticker: "AAPL_US_EQ", side: "BUY", type: "MARKET", status: "FILLED", initiatedFrom: "WEB" },
      fill: {
        id: 5501,
        filledAt: "2026-03-02T14:31:00Z",
        price: 88.1,
        quantity: 2,
        walletImpact: { currency: "EUR", fxRate: null, netValue: -176.2, realisedProfitLoss: null, taxes: [] },
      },
    };
    const parsed = historicalOrderSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.fill?.walletImpact?.fxRate).toBeUndefined();
    expect(parsed.data.fill?.walletImpact?.realisedProfitLoss).toBe(0);
  });

  it("netValue:null continua a cair no valor derivado do preco, nao em zero -- confirma que .default(0) nao voltou", () => {
    // Esta e a garantia central da correccao anterior ao netValue (comentario
    // em t212.schemas.ts): tornar "nulo vira zero" desarmaria o `??` do
    // toOrderRows. O teste passa null explicito, nao ausencia, porque e isso
    // que a API manda -- ausencia ja estava coberta noutro teste.
    const item = {
      order: { id: 991, ticker: "AAPL_US_EQ", side: "BUY", type: "MARKET", status: "FILLED", initiatedFrom: "WEB" },
      fill: {
        id: 1,
        filledAt: "2026-03-02T14:31:00Z",
        price: 10,
        quantity: 3,
        walletImpact: { netValue: null, fxRate: 1.08, realisedProfitLoss: 0, taxes: [] },
      },
    };
    const parsed = parseItems(historicalOrderSchema, [item]);
    expect(parsed.skipped).toEqual([]);

    const [row] = toOrderRows(parsed.items);
    expect(row.netValue).toBe("-30.00");
    expect(row.netValue).not.toBe("0.00");
  });

  it("dividendSchema aceita null em quantity, grossAmountPerShare e amountInEuro; amountInEuro:null continua a cair no amount", () => {
    const item = {
      reference: "div-77",
      paidOn: "2026-05-15T00:00:00Z",
      ticker: "AAPL_US_EQ",
      quantity: null,
      grossAmountPerShare: null,
      amount: 1.42,
      currency: "USD",
      amountInEuro: null,
      type: "ORDINARY",
    };
    const parsed = parseItems(dividendSchema, [item]);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.items[0].quantity).toBe(0);
    expect(parsed.items[0].grossAmountPerShare).toBe(0);

    const [row] = toDividendRows(parsed.items);
    expect(row.amountInEuro).toBe("1.42");
  });

  it("cashTransactionSchema mantem o type como enum estrito -- null continua a ser recusado", () => {
    // O type decide se dinheiro atravessa para o orcamento; nao entra no
    // ajudante de numeros nulos, nem sequer e numerico.
    const item = { amount: 500, currency: "EUR", dateTime: "2026-04-01T09:00:00Z", reference: "d-1", type: null };
    expect(cashTransactionSchema.safeParse(item).success).toBe(false);
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
