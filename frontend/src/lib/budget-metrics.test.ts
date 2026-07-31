import { describe, expect, it } from "vitest";
import type { GridResponse, GridRow, SectionTotal } from "../types/budget";
import { yearMetrics } from "./budget-metrics";

/** 12 meses em que apenas alguns tem valor. */
function months(values: Record<number, number>): string[] {
  return Array.from({ length: 12 }, (_, i) => (values[i] ?? 0).toFixed(2));
}

function total(section: string, m: Record<number, number>): SectionTotal {
  const arr = months(m);
  return {
    section,
    months: arr,
    total: arr.reduce((s, v) => s + Number(v), 0).toFixed(2),
  };
}

function grid(sectionTotals: SectionTotal[], rows: GridRow[] = []): GridResponse {
  return { year: 2026, rows, sectionTotals };
}

describe("yearMetrics", () => {
  it("soma as tres seccoes e calcula unallocated", () => {
    const m = yearMetrics(
      grid([
        total("income", { 0: 1000, 1: 1000 }),
        total("expenses", { 0: 600, 1: 500 }),
        total("savings", { 0: 200, 1: 200 }),
      ])
    );

    expect(m.income).toBe(2000);
    expect(m.expenses).toBe(1100);
    expect(m.savings).toBe(400);
    expect(m.unallocated).toBe(500);
  });

  it("da unallocated negativo quando se gasta mais do que entra", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 100 }), total("expenses", { 0: 250 })])
    );
    expect(m.unallocated).toBe(-150);
  });

  it("calcula a taxa de poupanca", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 1000 }), total("savings", { 0: 200 })])
    );
    expect(m.savingsRate).toBeCloseTo(0.2);
  });

  it("devolve savingsRate nulo quando nao ha receitas", () => {
    const m = yearMetrics(grid([total("expenses", { 0: 300 })]));
    expect(m.savingsRate).toBeNull();
  });

  it("devolve sempre 12 pontos mensais", () => {
    const m = yearMetrics(grid([total("income", { 5: 900 })]));
    expect(m.months).toHaveLength(12);
    expect(m.months[5]).toEqual({
      month: 5,
      income: 900,
      expenses: 0,
      savings: 0,
      unallocated: 900,
    });
    expect(m.months[0].income).toBe(0);
  });

  it("trata seccoes ausentes como zero", () => {
    const m = yearMetrics(grid([total("income", { 0: 500 })]));
    expect(m.expenses).toBe(0);
    expect(m.savings).toBe(0);
  });

  it("lastActiveMonth e o ultimo mes com movimento em qualquer seccao", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 100 }), total("expenses", { 7: 50 })])
    );
    expect(m.lastActiveMonth).toBe(7);
  });

  it("lastActiveMonth e nulo num ano sem movimento", () => {
    expect(yearMetrics(grid([])).lastActiveMonth).toBeNull();
    expect(yearMetrics(grid([total("income", {})])).lastActiveMonth).toBeNull();
  });
});
