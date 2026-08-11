import type { GridResponse } from "../types/budget";
import { isActiveMonth, sectionMonths, UNGROUPED } from "./budget-metrics";

export type CategoryDelta = {
  name: string;
  group: string;
  /** O valor liquido desta categoria no mes pedido. */
  amount: number;
  /** A media desta categoria nos meses activos do ano. */
  average: number;
  /** amount - average, em euros. */
  delta: number;
};

/**
 * O que foi diferente neste mes, por categoria.
 *
 * Responde a uma pergunta diferente do topCategories do monthDetail: aquele diz
 * onde se gasta mais, este diz o que saiu do costume. Um mes mau explica-se com
 * o segundo, nao com o primeiro.
 *
 * A media e sobre os meses ACTIVOS do ano -- os que tem receita, despesa ou
 * poupanca -- e uma categoria ausente num desses meses conta como zero, nao e
 * omitida. Uma despesa anual que so aparece uma vez tem custo medio mensal
 * baixo, e e essa a leitura correcta.
 */
export function categoryDeltas(
  data: GridResponse,
  monthIndex: number
): CategoryDelta[] {
  const inc = sectionMonths(data, "income");
  const exp = sectionMonths(data, "expenses");
  const sav = sectionMonths(data, "savings");

  // Mesmo predicado do lastActiveMonth em budget-metrics.ts, importado em vez
  // de reescrito: as duas nocoes de "mes activo" nunca podem divergir.
  const activeIdx: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (isActiveMonth({ income: inc[i], expenses: exp[i], savings: sav[i] })) {
      activeIdx.push(i);
    }
  }
  if (activeIdx.length === 0) return [];

  const out = data.rows
    .filter((r) => r.section === "expenses")
    .map((r) => {
      const months = r.months.map(Number);
      const amount = months[monthIndex];
      const average =
        activeIdx.reduce((s, i) => s + months[i], 0) / activeIdx.length;
      return {
        name: r.name,
        group: r.group === "" ? UNGROUPED : r.group,
        amount,
        average,
        delta: amount - average,
      };
    })
    // Uma categoria que esteve sempre a zero nao tem nada a dizer sobre este mes.
    .filter((c) => c.amount !== 0 || c.average !== 0);

  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
