import type { GridResponse } from "../types/budget";

export type MonthPoint = {
  month: number;
  income: number;
  expenses: number;
  savings: number;
  unallocated: number;
};

export type YearMetrics = {
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number | null;
  unallocated: number;
  months: MonthPoint[];
  lastActiveMonth: number | null;
};

/**
 * Os 12 valores mensais de uma seccao. As seccoes sem categorias nao vem no
 * payload, por isso a ausencia conta como zero.
 */
function sectionMonths(data: GridResponse, section: string): number[] {
  const found = data.sectionTotals.find((s) => s.section === section);
  if (!found) return Array.from({ length: 12 }, () => 0);
  return found.months.map(Number);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function yearMetrics(data: GridResponse): YearMetrics {
  const inc = sectionMonths(data, "income");
  const exp = sectionMonths(data, "expenses");
  const sav = sectionMonths(data, "savings");

  const months: MonthPoint[] = inc.map((_, i) => ({
    month: i,
    income: inc[i],
    expenses: exp[i],
    savings: sav[i],
    unallocated: inc[i] - exp[i] - sav[i],
  }));

  let lastActiveMonth: number | null = null;
  for (let i = 0; i < 12; i++) {
    if (inc[i] !== 0 || exp[i] !== 0 || sav[i] !== 0) lastActiveMonth = i;
  }

  const income = sum(inc);
  const expenses = sum(exp);
  const savings = sum(sav);

  return {
    income,
    expenses,
    savings,
    savingsRate: income > 0 ? savings / income : null,
    unallocated: income - expenses - savings,
    months,
    lastActiveMonth,
  };
}
