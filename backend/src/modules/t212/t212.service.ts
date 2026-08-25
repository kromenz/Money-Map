import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { loadT212Config } from "./t212.config";
import { investedSeries, type InvestedEvent } from "./t212.invested";
import { mergeChart, type ChartPoint } from "./t212.chart";
import { derivedCutoff } from "./t212.bridge";
import { prismaRepo } from "./t212.repo";
import { toHoldingViews, toStatusViews, type HoldingView, type StatusView } from "./t212.view";

export type OverviewResponse = {
  configured: boolean;
  snapshot: {
    date: string;
    cash: string;
    invested: string;
    marketValue: string;
    totalValue: string;
    realizedPl: string;
    unrealizedPl: string;
  } | null;
  holdings: HoldingView[];
  status: StatusView[];
  cutoff: string | null;
};

export async function getOverview(userId: string): Promise<OverviewResponse> {
  const cfg = loadT212Config();

  const [snapshot, holdings, states, lastExcel] = await Promise.all([
    prisma.portfolioSnapshot.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.holding.findMany({ where: { userId } }),
    prisma.syncState.findMany({ where: { userId }, select: { kind: true, lastRunAt: true, lastError: true } }),
    prismaRepo.lastExcelMonth(userId),
  ]);

  return {
    configured: cfg.configured,
    snapshot: snapshot
      ? {
          date: snapshot.date.toISOString().slice(0, 10),
          cash: snapshot.cash.toFixed(2),
          invested: snapshot.invested.toFixed(2),
          marketValue: snapshot.marketValue.toFixed(2),
          totalValue: snapshot.totalValue.toFixed(2),
          realizedPl: snapshot.realizedPl.toFixed(2),
          unrealizedPl: snapshot.unrealizedPl.toFixed(2),
        }
      : null,
    holdings: toHoldingViews(holdings),
    status: toStatusViews(states),
    cutoff: cfg.bridgeFrom ?? derivedCutoff(lastExcel),
  };
}

export async function getChart(userId: string): Promise<{ points: ChartPoint[] }> {
  const [orders, snapshots] = await Promise.all([
    prisma.brokerOrder.findMany({
      where: { userId },
      orderBy: { filledAt: "asc" },
      select: { filledAt: true, ticker: true, side: true, quantity: true, price: true },
    }),
    prisma.portfolioSnapshot.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { date: true, marketValue: true },
    }),
  ]);

  const events: InvestedEvent[] = orders.map((o) => ({
    date: o.filledAt.toISOString().slice(0, 10),
    ticker: o.ticker,
    side: o.side,
    quantity: o.quantity.toFixed(8),
    price: o.price.toFixed(8),
  }));

  return {
    points: mergeChart(
      investedSeries(events),
      snapshots.map((s) => ({
        date: s.date.toISOString().slice(0, 10),
        marketValue: s.marketValue.toFixed(2),
      }))
    ),
  };
}

export async function getDividends(userId: string, year?: number) {
  const where =
    year === undefined
      ? { userId }
      : {
          userId,
          paidOn: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
        };

  const rows = await prisma.brokerDividend.findMany({ where, orderBy: { paidOn: "desc" } });

  return {
    items: rows.map((r) => ({
      externalId: r.externalId,
      paidOn: r.paidOn.toISOString().slice(0, 10),
      ticker: r.ticker,
      quantity: r.quantity.toFixed(8),
      amount: r.amount.toFixed(2),
      currency: r.currency,
      amountInEuro: r.amountInEuro.toFixed(2),
      type: r.type,
    })),
    totalInEuro: rows
      .reduce((acc, r) => acc.add(r.amountInEuro), new Prisma.Decimal(0))
      .toFixed(2),
  };
}

export async function getOrders(
  userId: string,
  opts: { ticker?: string; side?: "BUY" | "SELL"; limit: number; offset: number }
) {
  const where = {
    userId,
    ...(opts.ticker ? { ticker: { contains: opts.ticker, mode: "insensitive" as const } } : {}),
    ...(opts.side ? { side: opts.side } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.brokerOrder.findMany({ where, orderBy: { filledAt: "desc" }, take: opts.limit, skip: opts.offset }),
    prisma.brokerOrder.count({ where }),
  ]);

  return {
    total,
    items: rows.map((r) => ({
      externalId: r.externalId,
      filledAt: r.filledAt.toISOString(),
      ticker: r.ticker,
      side: r.side,
      orderType: r.orderType,
      quantity: r.quantity.toFixed(8),
      price: r.price.toFixed(8),
      netValue: r.netValue.toFixed(2),
      fxRate: r.fxRate ? r.fxRate.toFixed(8) : null,
      initiatedFrom: r.initiatedFrom,
    })),
  };
}

export async function getCashFlows(userId: string, opts: { limit: number; offset: number }) {
  const [rows, total] = await Promise.all([
    prisma.brokerCashFlow.findMany({
      where: { userId },
      orderBy: { dateTime: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.brokerCashFlow.count({ where: { userId } }),
  ]);

  return {
    total,
    items: rows.map((r) => ({
      externalId: r.externalId,
      dateTime: r.dateTime.toISOString(),
      type: r.type,
      amount: r.amount.toFixed(2),
      currency: r.currency,
    })),
  };
}
