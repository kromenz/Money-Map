import type { z } from "zod";
import { PATHS } from "./t212.client";
import {
  accountSummarySchema,
  cashTransactionSchema,
  dividendSchema,
  historicalOrderSchema,
  parseItems,
  positionSchema,
} from "./t212.schemas";
import {
  toCashFlowRows,
  toDividendRows,
  toHoldingRows,
  toOrderRows,
  type CashFlowRow,
  type DividendRow,
  type HoldingRow,
  type OrderRow,
} from "./t212.map";
import { buildSnapshot, todayInLisbon, type SnapshotRow } from "./t212.snapshot";
import {
  runBridge,
  type BridgePlan,
  type BridgeSource,
} from "./t212.bridge";

export type HistoryKind = "orders" | "dividends" | "transactions";
/**
 * `bridge` esta aqui de proposito: ela nao le a API, mas e a etapa que mexe no
 * orcamento, e era a unica sem estado gravado -- podia falhar em todas as
 * corridas agendadas com as outras cinco verdes no painel e nada a dize-lo.
 */
export type StateKind =
  | HistoryKind
  | "summary"
  | "positions"
  | "bridge";

export type SyncRepo = {
  getState(
    userId: string,
    kind: HistoryKind
  ): Promise<{ backfillDone: boolean; backfillCursor: string | null } | null>;
  knownExternalIds(
    userId: string,
    kind: HistoryKind,
    ids: string[]
  ): Promise<Set<string>>;
  saveOrders(userId: string, rows: OrderRow[]): Promise<number>;
  saveDividends(userId: string, rows: DividendRow[]): Promise<number>;
  saveCashFlows(userId: string, rows: CashFlowRow[]): Promise<number>;
  replaceHoldings(userId: string, rows: HoldingRow[]): Promise<number>;
  upsertSnapshot(userId: string, row: SnapshotRow): Promise<void>;
  setState(
    userId: string,
    kind: StateKind,
    patch: {
      lastRunAt?: Date;
      lastError?: string | null;
      /** Quantos itens a corrida saltou no Zod. O StageReport ja contava; so faltava chegar aqui. */
      lastSkipped?: number;
      backfillCursor?: string | null;
      backfillDone?: boolean;
    }
  ): Promise<void>;
  lastExcelMonth(
    userId: string
  ): Promise<{ year: number; month: number } | null>;
  bridgeSource(userId: string): Promise<BridgeSource>;
  existingBridgeRows(
    userId: string
  ): Promise<{ externalId: string; amount: string }[]>;
  applyBridge(
    userId: string,
    plan: BridgePlan
  ): Promise<{ created: number; deleted: number; updated: number }>;
};

export type StageReport = {
  kind: string;
  ok: boolean;
  written: number;
  skipped: number;
  pages: number;
  error?: string;
  /** So preenchido pela etapa bridge: quantas linhas o corte apagou. */
  deleted?: number;
};

export type SyncReport = {
  startedAt: string;
  finishedAt: string;
  stages: StageReport[];
};

export type SyncClient = {
  request<T>(path: string): Promise<T>;
  paginate(
    path: string,
    query?: Record<string, string | number>,
    startPath?: string | null
  ): AsyncGenerator<{ items: unknown[]; nextPagePath: string | null }>;
};

export type SyncDeps = {
  client: SyncClient;
  repo: SyncRepo;
  now: () => Date;
  /** Corte explicito do .env. Null manda derivar do Excel. */
  cutoff: string | null;
};

const empty = (kind: string): StageReport => ({
  kind,
  ok: true,
  written: 0,
  skipped: 0,
  pages: 0,
});

/**
 * Cada etapa e independente. Uma que falhe grava o erro no estado e o relatorio
 * mostra-o, mas as seguintes correm na mesma: posicoes actualizadas e
 * dividendos em falta e um resultado legitimo, nao uma sincronizacao partida.
 */
async function stage(
  kind: StateKind,
  deps: SyncDeps,
  userId: string,
  run: (report: StageReport) => Promise<void>
): Promise<StageReport> {
  const report = empty(kind);

  try {
    await run(report);
  } catch (err) {
    report.ok = false;
    report.error = err instanceof Error ? err.message : String(err);
  }

  await deps.repo
    .setState(userId, kind, {
      lastRunAt: deps.now(),
      lastError: report.error ?? null,
      // report.skipped fica no que foi contado ate ao ponto da falha, se
      // houver uma -- melhor do que apagar o numero so porque a etapa nao
      // acabou limpa.
      lastSkipped: report.skipped,
    })
    .catch(() => undefined);

  return report;
}

async function syncHistory<T, R extends { externalId: string }>(
  userId: string,
  deps: SyncDeps,
  report: StageReport,
  opts: {
    kind: HistoryKind;
    path: string;
    schema: z.ZodType<T>;
    toRows: (items: T[]) => R[];
    save: (userId: string, rows: R[]) => Promise<number>;
  }
): Promise<void> {
  const state = await deps.repo.getState(userId, opts.kind);
  const backfilling = !state?.backfillDone;
  // O gerador do cliente pode parar por dois motivos: chegou ao fim
  // (nextPagePath:null) ou o guarda contra ciclos cortou porque um caminho se
  // repetiu. So o primeiro conta como "acabou" -- ver o if a seguir ao loop.
  let backfillReachedEnd = false;

  const pages = deps.client.paginate(
    opts.path,
    {},
    backfilling ? state?.backfillCursor ?? null : null
  );

  for await (const page of pages) {
    report.pages += 1;

    const parsed = parseItems(opts.schema, page.items);
    report.skipped += parsed.skipped.length;

    const rows = opts.toRows(parsed.items);
    let known = new Set<string>();

    if (rows.length > 0) {
      known = await deps.repo.knownExternalIds(
        userId,
        opts.kind,
        rows.map((r) => r.externalId)
      );
      const fresh = rows.filter((r) => !known.has(r.externalId));
      if (fresh.length > 0) report.written += await opts.save(userId, fresh);
    }

    if (backfilling) {
      // Durante o backfill nao se para no conhecido: as paginas vem da mais
      // recente para tras, e parar na primeira deixava a cauda do historico por
      // ler. Guarda-se o caminho da pagina seguinte para uma interrupcao nao
      // obrigar a recomecar -- no maximo repete-se a pagina que ja foi escrita,
      // e a escrita e idempotente pelo externalId.
      const done = page.nextPagePath === null;
      if (done) backfillReachedEnd = true;
      await deps.repo.setState(userId, opts.kind, {
        backfillCursor: done ? null : page.nextPagePath,
        backfillDone: done,
      });
      continue;
    }

    // Corrida incremental: a partir do primeiro conhecido e tudo historico ja
    // espelhado.
    if (known.size > 0) return;
  }

  if (backfilling && !backfillReachedEnd) {
    // O loop acabou sem nunca ver nextPagePath:null -- o guarda contra ciclos
    // do cliente cortou a paginacao a meio. Ficar calado aqui deixava
    // backfillDone em falso para sempre: cada corrida seguinte voltava a
    // reler o historico desde o cursor guardado sem nunca passar a
    // incremental, sem nenhum sinal disso no relatorio.
    throw new Error("paginacao terminou sem chegar ao fim do historico");
  }
}

export async function syncAll(
  userId: string,
  deps: SyncDeps
): Promise<SyncReport> {
  const startedAt = deps.now().toISOString();
  const stages: StageReport[] = [];

  stages.push(
    await stage("positions", deps, userId, async (report) => {
      const raw = await deps.client.request<unknown[]>(PATHS.positions);
      const parsed = parseItems(positionSchema, raw ?? []);
      report.skipped += parsed.skipped.length;

      if (parsed.items.length === 0 && parsed.skipped.length > 0) {
        // Tudo saltou no Zod -- provavelmente a T212 renomeou um campo.
        // replaceHoldings([]) apagava a carteira real sem repor nada, e a
        // etapa ainda dizia ok:true. Uma carteira desactualizada e muito
        // melhor do que uma carteira apagada.
        throw new Error(
          `todos os ${parsed.skipped.length} itens de posicoes foram saltados pelo Zod; carteira nao substituida`
        );
      }

      report.written = await deps.repo.replaceHoldings(
        userId,
        toHoldingRows(parsed.items)
      );
    })
  );

  stages.push(
    await stage("summary", deps, userId, async (report) => {
      const raw = await deps.client.request<unknown>(PATHS.summary);
      const summary = accountSummarySchema.parse(raw);
      await deps.repo.upsertSnapshot(
        userId,
        buildSnapshot(todayInLisbon(deps.now()), summary)
      );
      report.written = 1;
    })
  );

  stages.push(
    await stage("orders", deps, userId, (report) =>
      syncHistory(userId, deps, report, {
        kind: "orders",
        path: PATHS.orders,
        schema: historicalOrderSchema,
        toRows: toOrderRows,
        save: (u, rows) => deps.repo.saveOrders(u, rows),
      })
    )
  );

  stages.push(
    await stage("dividends", deps, userId, (report) =>
      syncHistory(userId, deps, report, {
        kind: "dividends",
        path: PATHS.dividends,
        schema: dividendSchema,
        toRows: toDividendRows,
        save: (u, rows) => deps.repo.saveDividends(u, rows),
      })
    )
  );

  stages.push(
    await stage("transactions", deps, userId, (report) =>
      syncHistory(userId, deps, report, {
        kind: "transactions",
        path: PATHS.transactions,
        schema: cashTransactionSchema,
        toRows: toCashFlowRows,
        save: (u, rows) => deps.repo.saveCashFlows(u, rows),
      })
    )
  );

  stages.push(
    await stage("bridge", deps, userId, async (report) => {
      const applied = await runBridge(userId, deps.repo, deps.cutoff);
      report.written = applied.created;
      // written:0 sozinho nao distingue "nada mudou" de "quarenta transaccoes
      // visiveis ao utilizador desapareceram porque o corte avancou".
      report.deleted = applied.deleted;
    })
  );

  return { startedAt, finishedAt: deps.now().toISOString(), stages };
}
