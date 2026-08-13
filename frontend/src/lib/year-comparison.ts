import type { GridResponse } from "../types/budget";
import { UNGROUPED, groupExpenses, yearMetrics } from "./budget-metrics";

export type YearTotals = {
  year: number;
  income: number;
  expenses: number;
  savings: number;
};

/** Um ponto por mes; null depois do ultimo mes com movimento. */
export type YearSeries = {
  year: number;
  points: (number | null)[];
};

function byYear<T extends { year: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.year - b.year);
}

export function yearTotals(grids: GridResponse[]): YearTotals[] {
  return byYear(
    grids.map((g) => {
      const m = yearMetrics(g);
      return {
        year: g.year,
        income: m.income,
        expenses: m.expenses,
        savings: m.savings,
      };
    })
  );
}

/**
 * Poupanca acumulada de cada ano, mes a mes.
 *
 * Depois do ultimo mes com movimento os pontos vao a null e a linha acaba ali.
 * Prolongar o acumulado ate Dezembro desenhava uma recta horizontal, que se le
 * como "nao poupou nada nesses meses" quando o que se passa e que esses meses
 * ainda nao aconteceram. O corte usa o lastActiveMonth do yearMetrics em vez de
 * uma regra propria, para nao haver duas definicoes de "mes com movimento".
 */
export function cumulativeSavings(grids: GridResponse[]): YearSeries[] {
  return byYear(
    grids.map((g) => {
      const m = yearMetrics(g);
      let running = 0;
      const points = m.months.map((p) => {
        if (m.lastActiveMonth === null || p.month > m.lastActiveMonth) return null;
        running += p.savings;
        return running;
      });
      return { year: g.year, points };
    })
  );
}

/** Composicao da despesa do ano inteiro, com o mesmo tecto que o mes usa. */
export function yearGroups(
  grid: GridResponse
): { group: string; amount: number }[] {
  const rows = grid.rows
    .filter((r) => r.section === "expenses")
    .map((r) => ({
      group: r.group === "" ? UNGROUPED : r.group,
      amount: r.months.reduce((s, v) => s + Number(v), 0),
    }))
    // Uma categoria a zeros no ano inteiro nao e composicao nenhuma.
    .filter((r) => r.amount !== 0);

  return groupExpenses(rows);
}
