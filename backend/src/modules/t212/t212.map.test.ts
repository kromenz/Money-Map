import { describe, it, expect } from "vitest";
import { money, qty, toHoldingRows, toOrderRows, toDividendRows, toCashFlowRows } from "./t212.map";

describe("money e qty", () => {
  it("dinheiro fica com duas casas e quantidade com oito", () => {
    expect(money(12.5)).toBe("12.50");
    expect(qty(0.5)).toBe("0.50000000");
  });

  it("arredonda em vez de truncar", () => {
    expect(money(1.005)).toBe("1.01");
  });

  it("arredonda simetricamente positivos e negativos", () => {
    // Os negativos sao comuns (compras, levantamentos, taxas) e precisam de
    // arredondar igual dos dois lados do zero, senao acumulam enviesamento.
    expect(money(1.005)).toBe("1.01");
    expect(money(-1.005)).toBe("-1.01");
    expect(money(2.675)).toBe("2.68");
    expect(money(-2.675)).toBe("-2.68");
  });

  it("arredonda pequenos negativos para longe do zero", () => {
    // -0.005 arredonda para -0.01, nao para zero: eh simetrico.
    expect(money(-0.005)).toBe("-0.01");
  });

  it("valores negativos comuns funcionam", () => {
    // netValue de uma compra, um levantamento, uma taxa.
    expect(money(-176.2)).toBe("-176.20");
    expect(money(-0.7)).toBe("-0.70");
  });

  it("nao empurra para cima valores genuinamente abaixo de meio centimo", () => {
    // Valores calculados (quantidade * preco) produzem precisao real nesta zona.
    // 0.00499999 esta mesmo abaixo de meio centimo, nao e ruido de representacao.
    expect(money(0.00499999)).toBe("0.00");
    expect(money(-0.00499999)).toBe("0.00"); // Nao deve ser "-0.00"
  });
});

describe("toHoldingRows", () => {
  const base = {
    instrument: { ticker: "AAPL_US_EQ", isin: "US0378331005", name: "Apple", currency: "USD" },
    quantity: 2,
    averagePricePaid: 100,
    currentPrice: 110,
  };

  it("usa o walletImpact quando existe", () => {
    const [row] = toHoldingRows([
      { ...base, walletImpact: { currentValue: 200.5, totalCost: 180.25, unrealizedProfitLoss: 20.25, fxImpact: -3.1 } },
    ]);

    expect(row.ticker).toBe("AAPL_US_EQ");
    expect(row.currentValue).toBe("200.50");
    expect(row.totalCost).toBe("180.25");
    expect(row.unrealizedPl).toBe("20.25");
    expect(row.fxImpact).toBe("-3.10");
  });

  it("calcula os totais quando o walletImpact falta", () => {
    const [row] = toHoldingRows([base]);

    expect(row.currentValue).toBe("220.00");
    expect(row.totalCost).toBe("200.00");
    expect(row.unrealizedPl).toBe("20.00");
    expect(row.fxImpact).toBe("0.00");
  });
});

describe("toOrderRows", () => {
  const order = { id: 991, ticker: "AAPL_US_EQ", side: "BUY" as const, type: "MARKET", status: "FILLED", initiatedFrom: "WEB" };

  it("a chave e a execucao, nao a ordem", () => {
    const rows = toOrderRows([
      { order, fill: { id: 1, filledAt: "2026-03-02T14:31:00Z", price: 88.1, quantity: 1, walletImpact: { netValue: -88.1, fxRate: 1.08, realisedProfitLoss: 0, taxes: [] } } },
      { order, fill: { id: 2, filledAt: "2026-03-02T14:32:00Z", price: 88.4, quantity: 1, walletImpact: { netValue: -88.4, fxRate: 1.08, realisedProfitLoss: 0, taxes: [] } } },
    ]);

    expect(rows.map((r) => r.externalId)).toEqual(["991:1", "991:2"]);
  });

  it("salta ordens sem execucao -- nao encheram, nao movimentaram dinheiro", () => {
    expect(toOrderRows([{ order }])).toEqual([]);
  });

  it("guarda cambio e taxas da execucao", () => {
    const [row] = toOrderRows([
      { order, fill: { id: 1, filledAt: "2026-03-02T14:31:00Z", price: 88.1, quantity: 2, walletImpact: { netValue: -176.2, fxRate: 1.0812, realisedProfitLoss: 0, taxes: [{ name: "STAMP_DUTY", amount: 0.5 }] } } },
    ]);

    expect(row.fxRate).toBe("1.08120000");
    expect(row.taxes).toEqual([{ name: "STAMP_DUTY", amount: 0.5 }]);
    expect(row.netValue).toBe("-176.20");
  });

  it("sem walletImpact deriva o netValue do preco e do lado", () => {
    const [compra] = toOrderRows([{ order, fill: { id: 1, filledAt: "2026-03-02T14:31:00Z", price: 10, quantity: 3 } }]);
    const [venda] = toOrderRows([{ order: { ...order, side: "SELL" as const }, fill: { id: 2, filledAt: "2026-03-03T14:31:00Z", price: 10, quantity: 3 } }]);

    expect(compra.netValue).toBe("-30.00");
    expect(venda.netValue).toBe("30.00");
    expect(compra.fxRate).toBeNull();
  });
});

describe("toDividendRows", () => {
  it("prefere o valor em euros que a API ja calcula", () => {
    const [row] = toDividendRows([
      { reference: "div-77", paidOn: "2026-05-15T00:00:00Z", ticker: "AAPL_US_EQ", quantity: 5.9, grossAmountPerShare: 0.24, amount: 1.42, currency: "USD", amountInEuro: 1.31, type: "ORDINARY" },
    ]);

    expect(row.externalId).toBe("div-77");
    expect(row.amount).toBe("1.42");
    expect(row.amountInEuro).toBe("1.31");
  });

  it("sem amountInEuro cai no amount", () => {
    const [row] = toDividendRows([
      { reference: "div-78", paidOn: "2026-05-15T00:00:00Z", ticker: "EUE_EQ", quantity: 1, grossAmountPerShare: 1, amount: 2.5, currency: "EUR", type: "" },
    ]);

    expect(row.amountInEuro).toBe("2.50");
  });
});

describe("toCashFlowRows", () => {
  it("converte os movimentos preservando o tipo", () => {
    const rows = toCashFlowRows([
      { reference: "d-1", dateTime: "2026-04-01T09:00:00Z", amount: 500, currency: "EUR", type: "DEPOSIT" },
      { reference: "f-1", dateTime: "2026-04-02T09:00:00Z", amount: -0.7, currency: "EUR", type: "FEE" },
    ]);

    expect(rows).toEqual([
      { externalId: "d-1", dateTime: "2026-04-01T09:00:00Z", amount: "500.00", currency: "EUR", type: "DEPOSIT" },
      { externalId: "f-1", dateTime: "2026-04-02T09:00:00Z", amount: "-0.70", currency: "EUR", type: "FEE" },
    ]);
  });
});
