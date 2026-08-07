import { describe, expect, it } from "vitest";
import type { GridResponse, GridRow, SectionTotal } from "../types/budget";
import { monthDetail, yearMetrics } from "./budget-metrics";

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

function row(
  name: string,
  group: string,
  m: Record<number, number>,
  section = "expenses"
): GridRow {
  const arr = months(m);
  return {
    categoryId: `${section}-${group}-${name}`,
    section: section as GridRow["section"],
    group,
    name,
    months: arr,
    total: arr.reduce((s, v) => s + Number(v), 0).toFixed(2),
  };
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

describe("monthDetail", () => {
  it("agrega as despesas do mes por grupo, do maior para o menor", () => {
    const d = monthDetail(
      grid(
        [total("expenses", { 0: 300 })],
        [
          row("Rent", "Home", { 0: 200 }),
          row("Bus", "Transport", { 0: 100 }),
        ]
      ),
      0
    );

    expect(d.byGroup).toEqual([
      { group: "Home", amount: 200 },
      { group: "Transport", amount: 100 },
    ]);
  });

  it("junta categorias sem grupo sob Ungrouped", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 80 })], [
        row("Misc", "", { 0: 50 }),
        row("Other bits", "", { 0: 30 }),
      ]),
      0
    );

    expect(d.byGroup).toEqual([{ group: "Ungrouped", amount: 80 }]);
  });

  it("ignora as seccoes que nao sao despesas", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 50 })], [
        row("Rent", "Home", { 0: 50 }),
        row("Salary", "", { 0: 2000 }, "income"),
      ]),
      0
    );

    expect(d.byGroup).toEqual([{ group: "Home", amount: 50 }]);
  });

  it("nao cria linha Other com cinco ou menos categorias", () => {
    const rows = [
      row("A", "G", { 0: 50 }),
      row("B", "G", { 0: 40 }),
      row("C", "G", { 0: 30 }),
      row("D", "G", { 0: 20 }),
      row("E", "G", { 0: 10 }),
    ];
    const d = monthDetail(grid([total("expenses", { 0: 150 })], rows), 0);

    expect(d.topCategories).toHaveLength(5);
    expect(d.topCategories.map((c) => c.name)).not.toContain("Other");
  });

  it("cria linha Other com a soma das restantes acima de cinco", () => {
    const rows = [
      row("A", "G", { 0: 60 }),
      row("B", "G", { 0: 50 }),
      row("C", "G", { 0: 40 }),
      row("D", "G", { 0: 30 }),
      row("E", "G", { 0: 20 }),
      row("F", "G", { 0: 7 }),
      row("H", "G", { 0: 3 }),
    ];
    const d = monthDetail(grid([total("expenses", { 0: 210 })], rows), 0);

    expect(d.topCategories).toHaveLength(6);
    expect(d.topCategories[5]).toEqual({ name: "Other", group: "", amount: 10 });
  });

  it("descarta categorias a zero nesse mes", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 50 })], [
        row("Rent", "Home", { 0: 50 }),
        row("Holiday", "Fun", { 6: 900 }),
      ]),
      0
    );

    expect(d.topCategories).toEqual([
      { name: "Rent", group: "Home", amount: 50 },
    ]);
  });

  it("devolve listas vazias num mes sem movimento", () => {
    const d = monthDetail(
      grid([total("expenses", { 6: 100 })], [row("Rent", "Home", { 6: 100 })]),
      0
    );

    expect(d.expenses).toBe(0);
    expect(d.byGroup).toEqual([]);
    expect(d.topCategories).toEqual([]);
    expect(d.savingsRate).toBeNull();
  });

  it("calcula os totais do mes escolhido", () => {
    const d = monthDetail(
      grid([
        total("income", { 3: 2000 }),
        total("expenses", { 3: 1200 }),
        total("savings", { 3: 400 }),
      ]),
      3
    );

    expect(d.month).toBe(3);
    expect(d.income).toBe(2000);
    expect(d.unallocated).toBe(400);
    expect(d.savingsRate).toBeCloseTo(0.2);
  });

  it("reembolsos (quantidades negativas) aparecem em topCategories, ordenados por ultimo", () => {
    const rows = [
      row("A", "G", { 0: 100 }),
      row("B", "G", { 0: 80 }),
      row("C", "G", { 0: 60 }),
      row("Refund", "G", { 0: -30 }),
    ];
    const d = monthDetail(
      grid([total("expenses", { 0: 210 })], rows),
      0
    );

    expect(d.topCategories).toHaveLength(4);
    expect(d.topCategories[3]).toEqual({ name: "Refund", group: "G", amount: -30 });
    expect(d.topCategories.map((c) => c.amount)).toEqual([100, 80, 60, -30]);
  });

  it("reembolsos em Other reduzem o total do Other e refletem-se no byGroup", () => {
    const rows = [
      row("A", "G", { 0: 60 }),
      row("B", "G", { 0: 50 }),
      row("C", "G", { 0: 40 }),
      row("D", "G", { 0: 30 }),
      row("E", "G", { 0: 20 }),
      row("F", "G", { 0: 7 }),
      row("Refund", "G", { 0: -5 }),
    ];
    const d = monthDetail(
      grid([total("expenses", { 0: 202 })], rows),
      0
    );

    expect(d.topCategories).toHaveLength(6);
    expect(d.topCategories[5]).toEqual({ name: "Other", group: "", amount: 2 });
    expect(d.byGroup[0]).toEqual({ group: "G", amount: 202 });
  });
});
