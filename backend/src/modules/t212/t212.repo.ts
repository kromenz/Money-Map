import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { SyncRepo } from "./t212.sync";
import { BRIDGE_PREFIX, excelMonthCap } from "./t212.bridge";
import type { StoredBridgeRow } from "./t212.sheet";

/** Dinheiro chega aqui em string e vira Decimal. Nunca passa por um float. */
const dec = (v: string) => new Prisma.Decimal(v);

/**
 * O omisso do Prisma para uma transaccao interactiva e 5s. A primeira ponte a
 * seguir a um backfill de anos pode ter centenas de linhas em toCreate; um
 * timeout explicito e generoso substitui a dependencia silenciosa do omisso.
 */
const BRIDGE_TX_TIMEOUT_MS = 30_000;

/**
 * Chave (section, group, name) que identifica uma categoria a resolver.
 * JSON.stringify evita colisoes entre nomes que possam conter o separador --
 * as tres categorias de CATEGORIES em t212.bridge.ts nunca colidiriam, mas a
 * chave nao pode depender disso.
 */
const categoryKey = (row: { section: string; group: string; name: string }) =>
  JSON.stringify([row.section, row.group, row.name]);

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
    // O limite ao mes corrente nao e enfeite: a folha tem meses futuros
    // preenchidos (rendas fixas, seguros anuais), e sem ele o maximo global
    // empurrava o corte para Janeiro do ano seguinte e a ponte deixava de
    // escrever no orcamento durante um ano inteiro, sem sinal nenhum.
    const row = await prisma.transaction.findFirst({
      where: {
        userId,
        source: "excel",
        date: { lt: excelMonthCap(new Date()) },
      },
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

  async existingBridgeRows(userId) {
    const rows = await prisma.transaction.findMany({
      where: { userId, source: "api", externalId: { startsWith: BRIDGE_PREFIX } },
      select: { externalId: true, amount: true },
    });

    // toFixed(2) dos dois lados: e assim que o bridgeRows produz o valor
    // desejado, e comparar duas escritas diferentes da mesma quantia dava uma
    // actualizacao a cada corrida.
    return rows.map((r) => ({
      externalId: r.externalId as string,
      amount: r.amount.toFixed(2),
    }));
  },

  async applyBridge(userId, plan) {
    if (
      plan.toDelete.length === 0 &&
      plan.toCreate.length === 0 &&
      plan.toUpdate.length === 0
    ) {
      return { created: 0, deleted: 0, updated: 0 };
    }

    return prisma.$transaction(
      async (tx) => {
        const deleted = plan.toDelete.length
          ? (
              await tx.transaction.deleteMany({
                where: {
                  userId,
                  source: "api",
                  // O prefixo repete aqui a garantia que o reconcilePlan ja da ao
                  // "existing": o apagar nunca pode sair do que a propria ponte
                  // criou, mesmo que source:"api" um dia sirva outro importador
                  // ou que alguem chame applyBridge com ids de fora do reconcilePlan.
                  externalId: { in: plan.toDelete, startsWith: BRIDGE_PREFIX },
                },
              })
            ).count
          : 0;

        // As categorias possiveis sao as tres de CATEGORIES em t212.bridge.ts.
        // Resolvidas uma vez aqui, fora do ciclo -- resolver por linha (ate
        // centenas delas na primeira ponte a seguir a um backfill de anos)
        // multiplicava idas sequenciais a base contra o limite de 5s da
        // transaccao interactiva e rebentava com P2028 sem nunca progredir,
        // porque a corrida seguinte encontrava o mesmo toCreate por criar.
        const categoryIds = new Map<string, string>();
        for (const row of plan.toCreate) {
          const key = categoryKey(row);
          if (categoryIds.has(key)) continue;

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
          categoryIds.set(key, category.id);
        }

        const created = plan.toCreate.length
          ? (
              await tx.transaction.createMany({
                data: plan.toCreate.map((row) => ({
                  userId,
                  date: new Date(row.date),
                  amount: dec(row.amount),
                  merchant: row.merchant,
                  rawDescription: row.rawDescription,
                  categoryId: categoryIds.get(categoryKey(row))!,
                  source: "api",
                  externalId: row.externalId,
                })),
              })
            ).count
          : 0;

        // Um updateMany por linha, e nao um em bloco: cada uma leva um valor
        // diferente. Sao os meses de juros, portanto uma mao cheia por
        // corrida -- nao vale a pena mais do que isto.
        //
        // O prefixo repete-se aqui pelo mesmo motivo que no deleteMany: a
        // garantia de nao mexer no que nao e da ponte nao pode depender de
        // quem chama.
        let updated = 0;
        for (const row of plan.toUpdate) {
          updated += (
            await tx.transaction.updateMany({
              where: {
                userId,
                source: "api",
                externalId: { equals: row.externalId, startsWith: BRIDGE_PREFIX },
              },
              data: { amount: dec(row.amount) },
            })
          ).count;
        }

        return { created, deleted, updated };
      },
      // Explicito em vez de confiar no omisso de 5s: mesmo com as categorias
      // resolvidas de antemao, um createMany de centenas de linhas junto com
      // ate tres upserts merece margem.
      { timeout: BRIDGE_TX_TIMEOUT_MS }
    );
  },
};

/**
 * A parte do repositorio que serve a escrita na folha.
 *
 * Fora do prismaRepo porque nao pertence ao SyncRepo: a sincronizacao nao
 * escreve no .xlsx nem sabe que ele existe. Quem escreve e o frontend, que e o
 * unico lado que conhece o BUDGET_FOLDER -- o backend corre num contentor e o
 * caminho e do sistema de ficheiros do utilizador.
 */
export const sheetRepo = {
  /**
   * Todas as linhas da ponte, com a categoria e o que delas ja esta na folha.
   *
   * Traz tudo e deixa a filtragem ao sheetEdits em vez de a pedir a base. A
   * comparacao "sheetAmount diferente de amount" precisava de referencias entre
   * colunas e de um ramo a parte para o null, e sao no maximo umas centenas de
   * linhas -- a clareza vale mais do que a query.
   */
  async bridgeRowsWithSheetState(userId: string): Promise<StoredBridgeRow[]> {
    const rows = await prisma.transaction.findMany({
      where: { userId, source: "api", externalId: { startsWith: BRIDGE_PREFIX } },
      select: {
        externalId: true,
        date: true,
        amount: true,
        sheetAmount: true,
        merchant: true,
        category: { select: { section: true, group: true, name: true } },
      },
      orderBy: { date: "asc" },
    });

    return rows
      // Uma linha sem categoria nao tem celula na folha para onde ir. O
      // onDelete: SetNull do Transaction.category deixa isso acontecer.
      .filter((r) => r.category !== null)
      .map((r) => ({
        externalId: r.externalId as string,
        date: r.date.toISOString().slice(0, 10),
        amount: r.amount.toFixed(2),
        sheetAmount: r.sheetAmount === null ? null : r.sheetAmount.toFixed(2),
        section: r.category!.section as StoredBridgeRow["section"],
        group: r.category!.group,
        name: r.category!.name,
        merchant: r.merchant ?? "Trading 212",
      }));
  },

  /**
   * Regista o que a folha aceitou.
   *
   * Grava o total da linha e nao o incremento: uma marcacao que se perca a
   * meio deixa a linha por marcar e a proxima corrida reescreve o mesmo delta,
   * o que e visivel; somar incrementos deixava a conta a meio caminho e a
   * folha calada.
   *
   * O prefixo repete-se no where pelo mesmo motivo de sempre: nada aqui pode
   * mexer no que nao e da ponte, seja qual for a lista que chegue.
   */
  async markSheetWritten(
    userId: string,
    written: { externalId: string; amount: string }[]
  ): Promise<number> {
    let marked = 0;
    for (const row of written) {
      marked += (
        await prisma.transaction.updateMany({
          where: {
            userId,
            source: "api",
            externalId: { equals: row.externalId, startsWith: BRIDGE_PREFIX },
          },
          data: { sheetAmount: dec(row.amount) },
        })
      ).count;
    }
    return marked;
  },
};
