import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { accountCurrencyPrice, investedSeries } from "./t212.invested";

const ev = (date: string, ticker: string, side: "BUY" | "SELL", quantity: string, price: string) => ({
  date,
  ticker,
  side,
  quantity,
  price,
});

describe("investedSeries", () => {
  it("sem eventos nao ha serie", () => {
    expect(investedSeries([])).toEqual([]);
  });

  it("uma compra investe quantidade vezes preco", () => {
    expect(investedSeries([ev("2026-01-05", "A", "BUY", "2", "10")])).toEqual([
      { date: "2026-01-05", invested: "20.00" },
    ]);
  });

  it("duas compras a precos diferentes somam o custo, nao a media", () => {
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "2", "10"),
      ev("2026-02-05", "A", "BUY", "2", "20"),
    ]);

    expect(serie).toEqual([
      { date: "2026-01-05", invested: "20.00" },
      { date: "2026-02-05", invested: "60.00" },
    ]);
  });

  it("uma venda parcial reduz pelo custo medio, nao pelo valor da venda", () => {
    // Custo medio 15 depois das duas compras. Vender 1 a 50 tira 15, nao 50.
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "2", "10"),
      ev("2026-02-05", "A", "BUY", "2", "20"),
      ev("2026-03-05", "A", "SELL", "1", "50"),
    ]);

    expect(serie[2]).toEqual({ date: "2026-03-05", invested: "45.00" });
  });

  it("vender tudo poe o investido a zero", () => {
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "2", "10"),
      ev("2026-03-05", "A", "SELL", "2", "50"),
    ]);

    expect(serie[1].invested).toBe("0.00");
  });

  it("vender mais do que se tem nao produz investido negativo", () => {
    // Acontece com desdobramentos e transferencias que nao vieram como compra.
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "1", "10"),
      ev("2026-03-05", "A", "SELL", "5", "10"),
    ]);

    expect(serie[1].invested).toBe("0.00");
  });

  it("soma varios titulos", () => {
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "1", "10"),
      ev("2026-01-06", "B", "BUY", "1", "5"),
    ]);

    expect(serie[1].invested).toBe("15.00");
  });

  it("eventos do mesmo dia dao um so ponto, com o estado final do dia", () => {
    const serie = investedSeries([
      ev("2026-01-05", "A", "BUY", "1", "10"),
      ev("2026-01-05", "B", "BUY", "1", "5"),
    ]);

    expect(serie).toEqual([{ date: "2026-01-05", invested: "15.00" }]);
  });

  it("ordena por data antes de calcular", () => {
    const serie = investedSeries([
      ev("2026-02-05", "A", "BUY", "1", "20"),
      ev("2026-01-05", "A", "BUY", "1", "10"),
    ]);

    expect(serie.map((p) => p.date)).toEqual(["2026-01-05", "2026-02-05"]);
    expect(serie[0].invested).toBe("10.00");
  });
});

describe("accountCurrencyPrice", () => {
  const dec = (v: string) => new Prisma.Decimal(v);

  it("uma execucao cuja netValue nao bate com price x quantity segue a netValue", () => {
    // Um titulo cotado em dolares: 10 accoes a 20 USD, mas o netValue diz que
    // sairam 184,00 EUR da conta. A serie tem de ficar em euros -- o preco por
    // accao e 18,40 EUR, nao 20.
    const preco = accountCurrencyPrice(dec("10"), dec("-184.00"));
    expect(preco.toFixed(2)).toBe("18.40");

    const serie = investedSeries([
      { date: "2026-01-05", ticker: "AAPL_US_EQ", side: "BUY", quantity: "10", price: preco.toFixed(8) },
    ]);
    expect(serie).toEqual([{ date: "2026-01-05", invested: "184.00" }]);
  });

  it("o sinal do movimento de caixa nao passa para o preco", () => {
    // Numa compra o netValue e negativo e numa venda e positivo; quem decide
    // somar ou subtrair na serie e o `side`.
    expect(accountCurrencyPrice(dec("4"), dec("-80.00")).toFixed(2)).toBe("20.00");
    expect(accountCurrencyPrice(dec("4"), dec("80.00")).toFixed(2)).toBe("20.00");
  });

  it("quantidade zero da zero em vez de rebentar a serie inteira", () => {
    expect(accountCurrencyPrice(dec("0"), dec("-80.00")).toFixed(2)).toBe("0.00");
  });
});
