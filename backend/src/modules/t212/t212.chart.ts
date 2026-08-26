import type { InvestedPoint } from "./t212.invested";

export type ChartPoint = {
  date: string;
  invested: string | null;
  marketValue: string | null;
};

/**
 * O investido e uma funcao em degrau -- so muda quando ha execucao -- e o valor
 * de mercado so existe nos dias em que a app correu.
 *
 * O que se arrasta e o investido; o valor de mercado nunca se arrasta. Arrastar
 * o ultimo valor conhecido de mercado desenharia uma linha recta por cima de
 * dias que ninguem mediu, que e exactamente o defeito da folha de Excel.
 */
export function mergeChart(
  invested: InvestedPoint[],
  snapshots: { date: string; marketValue: string }[]
): ChartPoint[] {
  const investedBy = new Map(invested.map((p) => [p.date, p.invested]));
  const marketBy = new Map(snapshots.map((s) => [s.date, s.marketValue]));

  const dates = [...new Set([...investedBy.keys(), ...marketBy.keys()])].sort();

  let carried: string | null = null;

  return dates.map((date) => {
    const own = investedBy.get(date);
    if (own !== undefined) carried = own;

    return {
      date,
      invested: carried,
      marketValue: marketBy.get(date) ?? null,
    };
  });
}
