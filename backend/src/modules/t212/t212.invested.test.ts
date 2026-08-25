import { describe, it, expect } from "vitest";
import { investedSeries } from "./t212.invested";

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
