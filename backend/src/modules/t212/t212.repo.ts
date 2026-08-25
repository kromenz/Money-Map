import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { SyncRepo } from "./t212.sync";

/** Dinheiro chega aqui em string e vira Decimal. Nunca passa por um float. */
const dec = (v: string) => new Prisma.Decimal(v);

const TABLE = {
  orders: "brokerOrder",
  dividends: "brokerDividend",
  transactions: "brokerCashFlow",
} as const;

export const prismaRepo: SyncRepo = {
  async getState(userId, kind) {
    return prisma.syncState.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { backfillDone: true, backfillCursor: true },
    });
  },

  async knownExternalIds(userId, kind, ids) {
    if (ids.length === 0) return new Set();

    const rows = await (prisma[TABLE[kind]] as any).findMany({
      where: { userId, externalId: { in: ids } },
      select: { externalId: true },
    });

    return new Set(rows.map((r: { externalId: string }) => r.externalId));
  },

  async saveOrders(userId, rows) {
    const { count } = await prisma.brokerOrder.createMany({
      data: rows.map((r) => ({
        userId,
        externalId: r.externalId,
        filledAt: new Date(r.filledAt),
        ticker: r.ticker,
        side: r.side,
        orderType: r.orderType,
        quantity: dec(r.quantity),
        price: dec(r.price),
        netValue: dec(r.netValue),
        fxRate: r.fxRate === null ? null : dec(r.fxRate),
        taxes: (r.taxes ?? undefined) as Prisma.InputJsonValue | undefined,
        initiatedFrom: r.initiatedFrom,
        status: r.status,
      })),
      // Rede de seguranca por cima da paragem no conhecido: duas corridas em
      // simultaneo nunca produzem duplicados.
      skipDuplicates: true,
    });
    return count;
  },

  async saveDividends(userId, rows) {
    const { count } = await prisma.brokerDividend.createMany({
      data: rows.map((r) => ({
        userId,
        externalId: r.externalId,
        paidOn: new Date(r.paidOn),
        ticker: r.ticker,
        quantity: dec(r.quantity),
        grossAmountPerShare: dec(r.grossAmountPerShare),
        amount: dec(r.amount),
        currency: r.currency,
        amountInEuro: dec(r.amountInEuro),
        type: r.type,
      })),
      skipDuplicates: true,
    });
    return count;
  },

  async saveCashFlows(userId, rows) {
    const { count } = await prisma.brokerCashFlow.createMany({
      data: rows.map((r) => ({
        userId,
        externalId: r.externalId,
        dateTime: new Date(r.dateTime),
        type: r.type,
        amount: dec(r.amount),
        currency: r.currency,
      })),
      skipDuplicates: true,
    });
    return count;
  },

  async replaceHoldings(userId, rows) {
    // Retrato, nao historico: o que saiu da carteira tem de sair da tabela.
    const [, created] = await prisma.$transaction([
      prisma.holding.deleteMany({ where: { userId } }),
      prisma.holding.createMany({
        data: rows.map((r) => ({
          userId,
          ticker: r.ticker,
          name: r.name,
          currency: r.currency,
          quantity: dec(r.quantity),
          averagePricePaid: dec(r.averagePricePaid),
          currentPrice: dec(r.currentPrice),
          currentValue: dec(r.currentValue),
          totalCost: dec(r.totalCost),
          unrealizedPl: dec(r.unrealizedPl),
          fxImpact: dec(r.fxImpact),
        })),
      }),
    ]);
    return created.count;
  },

  async upsertSnapshot(userId, row) {
    const data = {
      cash: dec(row.cash),
      invested: dec(row.invested),
      marketValue: dec(row.marketValue),
      totalValue: dec(row.totalValue),
      realizedPl: dec(row.realizedPl),
      unrealizedPl: dec(row.unrealizedPl),
    };

    // Duas corridas no mesmo dia actualizam a mesma linha.
    await prisma.portfolioSnapshot.upsert({
      where: { userId_date: { userId, date: new Date(row.date) } },
      create: { userId, date: new Date(row.date), ...data },
      update: data,
    });
  },

  async setState(userId, kind, patch) {
    await prisma.syncState.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, ...patch },
      update: patch,
    });
  },

  async lastExcelMonth(userId) {
    const row = await prisma.transaction.findFirst({
      where: { userId, source: "excel" },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    if (!row) return null;
    return { year: row.date.getUTCFullYear(), month: row.date.getUTCMonth() + 1 };
  },

  async bridgeSource(userId) {
    const [cashflows, dividends] = await Promise.all([
      prisma.brokerCashFlow.findMany({
        where: { userId },
        select: { externalId: true, dateTime: true, type: true, amount: true },
      }),
      prisma.brokerDividend.findMany({
        where: { userId },
        select: { externalId: true, paidOn: true, ticker: true, amountInEuro: true },
      }),
    ]);

    return {
      cashflows: cashflows.map((c) => ({
        externalId: c.externalId,
        dateTime: c.dateTime.toISOString(),
        type: c.type,
        amount: c.amount.toFixed(2),
      })),
      dividends: dividends.map((d) => ({
        externalId: d.externalId,
        paidOn: d.paidOn.toISOString(),
        ticker: d.ticker,
        amountInEuro: d.amountInEuro.toFixed(2),
      })),
    };
  },

  async existingBridgeIds(userId) {
    return prisma.transaction.findMany({
      where: { userId, source: "api", externalId: { startsWith: "t212:" } },
      select: { externalId: true },
    }) as Promise<{ externalId: string }[]>;
  },

  async applyBridge(userId, plan) {
    if (plan.toDelete.length === 0 && plan.toCreate.length === 0) {
      return { created: 0, deleted: 0 };
    }

    return prisma.$transaction(async (tx) => {
      const deleted = plan.toDelete.length
        ? (
            await tx.transaction.deleteMany({
              where: { userId, source: "api", externalId: { in: plan.toDelete } },
            })
          ).count
        : 0;

      let created = 0;
      for (const row of plan.toCreate) {
        // A categoria resolve-se por (section, group, name) e cria-se se faltar
        // -- a folha pode ainda nao ter a linha dos dividendos.
        const category = await tx.category.upsert({
          where: {
            userId_section_group_name: {
              userId,
              section: row.section,
              group: row.group,
              name: row.name,
            },
          },
          create: { userId, section: row.section, group: row.group, name: row.name },
          update: {},
          select: { id: true },
        });

        await tx.transaction.create({
          data: {
            userId,
            date: new Date(row.date),
            amount: dec(row.amount),
            merchant: row.merchant,
            rawDescription: row.rawDescription,
            categoryId: category.id,
            source: "api",
            externalId: row.externalId,
          },
        });
        created += 1;
      }

      return { created, deleted };
    });
  },
};
