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

export type MonthDetail = {
  month: number;
  income: number;
  expenses: number;
  savings: number;
  unallocated: number;
  savingsRate: number | null;
  byGroup: { group: string; amount: number }[];
  topCategories: { name: string; group: string; amount: number }[];
};

const UNGROUPED = "Ungrouped";
const TOP_N = 5;

export function monthDetail(
  data: GridResponse,
  monthIndex: number
): MonthDetail {
  const income = sectionMonths(data, "income")[monthIndex];
  const expenses = sectionMonths(data, "expenses")[monthIndex];
  const savings = sectionMonths(data, "savings")[monthIndex];

  const spent = data.rows
    .filter((r) => r.section === "expenses")
    .map((r) => ({
      name: r.name,
      group: r.group === "" ? UNGROUPED : r.group,
      amount: Number(r.months[monthIndex]),
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  const groups = new Map<string, number>();
  for (const r of spent) groups.set(r.group, (groups.get(r.group) ?? 0) + r.amount);

  const byGroup = Array.from(groups, ([group, amount]) => ({ group, amount })).sort(
    (a, b) => b.amount - a.amount
  );

  const topCategories = spent.slice(0, TOP_N);
  if (spent.length > TOP_N) {
    const rest = spent.slice(TOP_N).reduce((s, r) => s + r.amount, 0);
    topCategories.push({ name: "Other", group: "", amount: rest });
  }

  return {
    month: monthIndex,
    income,
    expenses,
    savings,
    unallocated: income - expenses - savings,
    savingsRate: income > 0 ? savings / income : null,
    byGroup,
    topCategories,
  };
}
