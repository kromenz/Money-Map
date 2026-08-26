import type { ChartPoint, DividendItem, Holding } from "@/types/t212";

export type WeightedHolding = Holding & { weight: number | null };

/** O peso e so apresentacao: o dinheiro ja veio somado do servidor. */
export function withWeights(holdings: Holding[]): WeightedHolding[] {
  const total = holdings.reduce((acc, h) => acc + Number(h.currentValue), 0);

  return holdings.map((h) => ({
    ...h,
    weight: total === 0 ? null : Number(h.currentValue) / total,
  }));
}

export type ChartDatum = {
  date: string;
  invested: number | null;
  marketValue: number | null;
};

/**
 * Null continua null. Trocar por zero fazia a linha cair a pique ate ao eixo
 * nos dias em que a app nao correu, e um buraco de medicao passava a parecer
 * uma perda total.
 */
export function chartData(points: ChartPoint[]): ChartDatum[] {
  return points.map((p) => ({
    date: p.date,
    invested: p.invested === null ? null : Number(p.invested),
    marketValue: p.marketValue === null ? null : Number(p.marketValue),
  }));
}

export function dividendsByMonth(
  items: DividendItem[],
  year: number
): { month: number; total: number }[] {
  const totals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0 }));

  for (const item of items) {
    if (!item.paidOn.startsWith(String(year))) continue;
    const month = Number(item.paidOn.slice(5, 7));
    totals[month - 1].total += Number(item.amountInEuro);
  }

  return totals;
}
