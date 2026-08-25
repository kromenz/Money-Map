import { Prisma } from "@prisma/client";

export type InvestedEvent = {
  /** YYYY-MM-DD. */
  date: string;
  ticker: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
};

export type InvestedPoint = { date: string; invested: string };

type Lot = { quantity: Prisma.Decimal; avgCost: Prisma.Decimal };

const ZERO = new Prisma.Decimal(0);

/**
 * Capital investido = soma de (quantidade x custo medio) por titulo.
 *
 * O ponto delicado e a venda: reduz o investido pelo custo medio das accoes
 * vendidas, nunca pelo valor da venda. Usar o valor da venda daria numeros
 * plausiveis e errados -- uma venda com lucro punha o investido negativo.
 *
 * Decimal e nao numero: sao centenas de multiplicacoes e divisoes encadeadas, e
 * o erro de virgula flutuante acumula visivelmente ao longo de anos de ordens.
 */
export function investedSeries(events: InvestedEvent[]): InvestedPoint[] {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const lots = new Map<string, Lot>();
  const points: InvestedPoint[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const e = ordered[i];
    const quantity = new Prisma.Decimal(e.quantity);
    const price = new Prisma.Decimal(e.price);
    const lot = lots.get(e.ticker) ?? { quantity: ZERO, avgCost: ZERO };

    if (e.side === "BUY") {
      const newQuantity = lot.quantity.add(quantity);
      const newCost = lot.quantity.mul(lot.avgCost).add(quantity.mul(price));
      lots.set(e.ticker, {
        quantity: newQuantity,
        avgCost: newQuantity.isZero() ? ZERO : newCost.div(newQuantity),
      });
    } else {
      // Vender mais do que se tem acontece com desdobramentos e transferencias
      // que nunca entraram como compra. Cortar em zero em vez de ir a negativo.
      const sold = quantity.greaterThan(lot.quantity) ? lot.quantity : quantity;
      const left = lot.quantity.sub(sold);
      lots.set(e.ticker, {
        quantity: left,
        avgCost: left.isZero() ? ZERO : lot.avgCost,
      });
    }

    // Um ponto por dia: se o evento seguinte e do mesmo dia, este ponto seria
    // substituido de qualquer forma.
    const sameDayAhead = ordered[i + 1]?.date === e.date;
    if (sameDayAhead) continue;

    let total = ZERO;
    for (const l of lots.values()) total = total.add(l.quantity.mul(l.avgCost));
    points.push({ date: e.date, invested: total.toFixed(2) });
  }

  return points;
}
