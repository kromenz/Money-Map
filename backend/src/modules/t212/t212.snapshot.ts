import { money } from "./t212.map";
import type { AccountSummary } from "./t212.schemas";

export type SnapshotRow = {
  date: string;
  cash: string;
  invested: string;
  marketValue: string;
  totalValue: string;
  realizedPl: string;
  unrealizedPl: string;
};

/**
 * O dia e o de Lisboa, nao o de UTC: um snapshot tirado as 23:40 de um dia de
 * verao ficaria com a data do dia seguinte e deixaria um buraco no grafico.
 */
export function todayInLisbon(now: Date): string {
  // en-CA formata como YYYY-MM-DD, que e exactamente o que a coluna @db.Date
  // e as comparacoes de string esperam.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function buildSnapshot(
  date: string,
  summary: AccountSummary
): SnapshotRow {
  return {
    date,
    // So o disponivel para negociar: o inPies ja conta dentro do investido.
    cash: money(summary.cash.availableToTrade),
    invested: money(summary.investments.totalCost),
    marketValue: money(summary.investments.currentValue),
    totalValue: money(summary.totalValue),
    realizedPl: money(summary.investments.realizedProfitLoss),
    unrealizedPl: money(summary.investments.unrealizedProfitLoss),
  };
}
