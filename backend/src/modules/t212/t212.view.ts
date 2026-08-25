import type { Prisma } from "@prisma/client";

type Dec = Prisma.Decimal;

export type HoldingRecord = {
  ticker: string;
  name: string;
  currency: string;
  quantity: Dec;
  averagePricePaid: Dec;
  currentPrice: Dec;
  currentValue: Dec;
  totalCost: Dec;
  unrealizedPl: Dec;
  fxImpact: Dec;
};

export type HoldingView = {
  ticker: string;
  name: string;
  currency: string;
  quantity: string;
  averagePricePaid: string;
  currentPrice: string;
  currentValue: string;
  totalCost: string;
  unrealizedPl: string;
  fxImpact: string;
};

export type StatusView = {
  kind: string;
  lastRunAt: string | null;
  lastError: string | null;
};

/** Dinheiro sai em string, como no resto da API. */
export function toHoldingViews(rows: HoldingRecord[]): HoldingView[] {
  return [...rows]
    .sort((a, b) => b.currentValue.comparedTo(a.currentValue))
    .map((r) => ({
      ticker: r.ticker,
      name: r.name,
      currency: r.currency,
      quantity: r.quantity.toFixed(8),
      averagePricePaid: r.averagePricePaid.toFixed(8),
      currentPrice: r.currentPrice.toFixed(8),
      currentValue: r.currentValue.toFixed(2),
      totalCost: r.totalCost.toFixed(2),
      unrealizedPl: r.unrealizedPl.toFixed(2),
      fxImpact: r.fxImpact.toFixed(2),
    }));
}

export function toStatusViews(
  rows: { kind: string; lastRunAt: Date | null; lastError: string | null }[]
): StatusView[] {
  return rows.map((r) => ({
    kind: r.kind,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    lastError: r.lastError,
  }));
}
