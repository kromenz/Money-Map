import type { GridResponse } from "../types/budget";

export type MonthPoint = {
  month: number;
  income: number;
  expenses: number;
  savings: number;
  unallocated: number;
};

/** Medias por mes ACTIVO, nao por mes do calendario. */
export type MonthAverages = {
  activeMonths: number;
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
  averages: MonthAverages;
};

/**
 * Os 12 valores mensais de uma seccao. As seccoes sem categorias nao vem no
 * payload, por isso a ausencia conta como zero.
 */
export function sectionMonths(data: GridResponse, section: string): number[] {
  const found = data.sectionTotals.find((s) => s.section === section);
  if (!found) return Array.from({ length: 12 }, () => 0);
  return found.months.map(Number);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Um mes conta como activo se tiver receita, despesa ou poupanca diferente
 * de zero. Um mes sem movimento nenhum nao e um mes de zero euros: e um mes
 * que ainda nao aconteceu. Usada tanto por lastActiveMonth como pelas medias,
 * para as duas nocoes de "mes activo" nunca poderem divergir.
 */
export function isActiveMonth(m: {
  income: number;
  expenses: number;
  savings: number;
}): boolean {
  return m.income !== 0 || m.expenses !== 0 || m.savings !== 0;
}

/**
 * A variacao relativa de um valor face a media, ou null quando a media e zero.
 *
 * Contra zero nao existe variacao percentual, e devolver 0 ou Infinity mentia
 * das duas maneiras. Devolver null obriga quem desenha a decidir o que mostrar.
 *
 * O denominador e o valor ABSOLUTO da media: o que sobra pode ter media
 * negativa (um ano em defice), e sem o modulo sobrar -50 contra media -100
 * daria um desvio negativo quando na verdade e melhor que a media.
 */
export function deltaVsAverage(value: number, average: number): number | null {
  if (average === 0) return null;
  return (value - average) / Math.abs(average);
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
  for (const m of months) {
    if (isActiveMonth(m)) lastActiveMonth = m.month;
  }

  // Entrar os meses inactivos na media punha todos os meses reais acima do
  // normal, por isso usa-se o mesmo predicado do lastActiveMonth acima.
  const active = months.filter(isActiveMonth);
  const mean = (pick: (m: MonthPoint) => number) =>
    active.length === 0 ? 0 : sum(active.map(pick)) / active.length;

  const averages: MonthAverages = {
    activeMonths: active.length,
    income: mean((m) => m.income),
    expenses: mean((m) => m.expenses),
    savings: mean((m) => m.savings),
    unallocated: mean((m) => m.unallocated),
  };

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
    averages,
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

export const UNGROUPED = "Ungrouped";
const TOP_N = 5;
// A rampa de composicao tem seis cores e o metodo proibe cicla-las: com sete
// grupos o setimo ficava com a cor do primeiro. Cinco nomeados mais Other da
// exactamente seis segmentos.
const TOP_GROUPS = 5;

/**
 * Recebe uma linha por CATEGORIA, soma-as por grupo e corta no tecto.
 *
 * O resto e SOMADO numa entrada "Other" e nao descartado: quem desenha a barra
 * de composicao divide cada valor pelo total, e um total a que faltassem os
 * grupos cortados fazia a barra mentir sobre a proporcao.
 */
export function groupExpenses(
  rows: { group: string; amount: number }[]
): { group: string; amount: number }[] {
  const groups = new Map<string, number>();
  for (const r of rows) groups.set(r.group, (groups.get(r.group) ?? 0) + r.amount);

  const byGroup = Array.from(groups, ([group, amount]) => ({ group, amount })).sort(
    (a, b) => b.amount - a.amount
  );

  const capped = byGroup.slice(0, TOP_GROUPS);
  if (byGroup.length > TOP_GROUPS) {
    const rest = byGroup.slice(TOP_GROUPS).reduce((s, g) => s + g.amount, 0);
    capped.push({ group: "Other", amount: rest });
  }
  return capped;
}

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
    // Reembolsos chegam como valores negativos (o backend inverte o sinal de
    // tudo o que nao seja "income"). Uma categoria-mes so fica negativa quando
    // os reembolsos superam o gasto nesse mes - raro, mas real - e o valor
    // liquido e a resposta correcta para o que a categoria custou de facto.
    // Nao filtramos nem fazemos clamp aqui: isso quebraria a reconciliacao
    // entre byGroup, topCategories e os totais da seccao. Camadas de
    // apresentacao que nao conseguem desenhar valores negativos (ex.: fatias
    // de um grafico circular) devem filtrar no momento de renderizar, nao aqui.
    .filter((r) => r.amount !== 0)
    .sort((a, b) => b.amount - a.amount);

  const byGroup = groupExpenses(spent);

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
