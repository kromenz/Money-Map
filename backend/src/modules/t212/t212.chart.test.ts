import { describe, it, expect } from "vitest";
import { mergeChart } from "./t212.chart";

describe("mergeChart", () => {
  it("sem nada devolve serie vazia", () => {
    expect(mergeChart([], [])).toEqual([]);
  });

  it("junta as duas series pela data", () => {
    const out = mergeChart(
      [{ date: "2026-01-05", invested: "100.00" }],
      [{ date: "2026-01-05", marketValue: "105.00" }]
    );

    expect(out).toEqual([{ date: "2026-01-05", invested: "100.00", marketValue: "105.00" }]);
  });

  it("o investido mantem-se entre execucoes -- e uma funcao em degrau", () => {
    const out = mergeChart(
      [{ date: "2026-01-05", invested: "100.00" }],
      [{ date: "2026-01-06", marketValue: "110.00" }]
    );

    expect(out[1]).toEqual({ date: "2026-01-06", invested: "100.00", marketValue: "110.00" });
  });

  it("antes da primeira execucao o investido e nulo, nao zero", () => {
    // Zero diria "tinha zero investido". Nulo diz "nao se sabe", que e a
    // verdade antes de haver historico.
    const out = mergeChart(
      [{ date: "2026-02-01", invested: "100.00" }],
      [{ date: "2026-01-01", marketValue: "0.00" }]
    );

    expect(out[0].invested).toBeNull();
  });

  it("um dia sem snapshot fica com valor de mercado nulo -- e a lacuna", () => {
    const out = mergeChart(
      [
        { date: "2026-01-05", invested: "100.00" },
        { date: "2026-01-07", invested: "200.00" },
      ],
      [{ date: "2026-01-05", marketValue: "105.00" }]
    );

    expect(out[1]).toEqual({ date: "2026-01-07", invested: "200.00", marketValue: null });
  });

  it("devolve as datas por ordem crescente", () => {
    const out = mergeChart(
      [{ date: "2026-03-01", invested: "1.00" }],
      [
        { date: "2026-02-01", marketValue: "2.00" },
        { date: "2026-01-01", marketValue: "3.00" },
      ]
    );

    expect(out.map((p) => p.date)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });
});
