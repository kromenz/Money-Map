import { describe, it, expect, vi } from "vitest";
import { syncAll, type SyncRepo, type SyncClient, type SyncDeps } from "./t212.sync";

const summary = {
  currency: "EUR",
  cash: { availableToTrade: 100, inPies: 0, reservedForOrders: 0 },
  investments: { currentValue: 500, totalCost: 400, realizedProfitLoss: 0, unrealizedProfitLoss: 100 },
  totalValue: 600,
};

const position = {
  instrument: { ticker: "AAPL_US_EQ", isin: "US1", name: "Apple", currency: "USD" },
  quantity: 1,
  averagePricePaid: 100,
  currentPrice: 110,
};

const orderItem = (orderId: number, fillId: number) => ({
  order: { id: orderId, ticker: "AAPL_US_EQ", side: "BUY", type: "MARKET", status: "FILLED", initiatedFrom: "WEB" },
  fill: { id: fillId, filledAt: "2026-03-02T14:31:00Z", price: 10, quantity: 1, walletImpact: { netValue: -10, realisedProfitLoss: 0, taxes: [] } },
});

const dividendItem = (ref: string) => ({
  reference: ref, paidOn: "2026-05-15T00:00:00Z", ticker: "AAPL_US_EQ",
  quantity: 1, grossAmountPerShare: 1, amount: 1, currency: "EUR", amountInEuro: 1, type: "ORDINARY",
});

const cashItem = (ref: string) => ({
  reference: ref, dateTime: "2026-04-01T09:00:00Z", amount: 500, currency: "EUR", type: "DEPOSIT",
});

function fakeRepo(overrides: Partial<SyncRepo> = {}): SyncRepo {
  return {
    // Por omissao o backfill ja acabou: e o estado normal, e o que faz a
    // paragem no conhecido entrar em jogo.
    getState: vi.fn(async () => ({ backfillDone: true, backfillCursor: null })),
    knownExternalIds: vi.fn(async () => new Set<string>()),
    saveOrders: vi.fn(async (_u, rows) => rows.length),
    saveDividends: vi.fn(async (_u, rows) => rows.length),
    saveCashFlows: vi.fn(async (_u, rows) => rows.length),
    replaceHoldings: vi.fn(async (_u, rows) => rows.length),
    upsertSnapshot: vi.fn(async () => {}),
    setState: vi.fn(async () => {}),
    lastExcelMonth: vi.fn(async () => null),
    bridgeSource: vi.fn(async () => ({ cashflows: [], dividends: [] })),
    existingBridgeIds: vi.fn(async () => []),
    applyBridge: vi.fn(async () => ({ created: 0, deleted: 0 })),
    ...overrides,
  };
}

function fakeClient(pages: Record<string, unknown[][]>) {
  return {
    request: vi.fn(async (path: string) => {
      if (path.includes("summary")) return summary;
      if (path.includes("positions")) return [position];
      throw new Error(`caminho inesperado: ${path}`);
    }),
    paginate: async function* (
      path: string,
      _query: Record<string, string | number> = {},
      startPath: string | null = null
    ) {
      const key = path.includes("orders") ? "orders" : path.includes("dividends") ? "dividends" : "transactions";
      const all = pages[key] ?? [[]];
      // Retomar e comecar na pagina que o caminho guardado aponta.
      const from = startPath ? Number(startPath.split("=")[1]) : 0;

      for (let i = from; i < all.length; i += 1) {
        yield { items: all[i], nextPagePath: i + 1 < all.length ? `/p?cursor=${i + 1}` : null };
      }
    },
  };
}

const deps = (client: ReturnType<typeof fakeClient>, repo: SyncRepo): SyncDeps => ({
  // O mock devolve uma uniao concreta, nao um T generico -- o vitest nao
  // type-checa (esbuild), mas o tsc --noEmit exige a mesma forma que o
  // request<T> real do cliente. So a forma do teste que muda, nao o
  // comportamento.
  client: client as unknown as SyncClient,
  repo,
  now: () => new Date("2026-08-25T10:00:00Z"),
  cutoff: null,
});

describe("syncAll", () => {
  it("escreve as linhas novas de todas as paginas", async () => {
    const repo = fakeRepo();
    const client = fakeClient({ orders: [[orderItem(1, 1)], [orderItem(2, 2)]] });

    const report = await syncAll("u1", deps(client, repo));
    const orders = report.stages.find((s) => s.kind === "orders")!;

    expect(orders.ok).toBe(true);
    expect(orders.written).toBe(2);
    expect(orders.pages).toBe(2);
  });

  it("para na pagina em que aparece um item ja conhecido", async () => {
    const repo = fakeRepo({
      knownExternalIds: vi.fn(async (_u, _k, ids: string[]) =>
        new Set(ids.filter((id) => id === "1:1"))
      ),
    });
    const client = fakeClient({ orders: [[orderItem(1, 1)], [orderItem(2, 2)]] });

    const report = await syncAll("u1", deps(client, repo));
    const orders = report.stages.find((s) => s.kind === "orders")!;

    expect(orders.pages).toBe(1);
    expect(orders.written).toBe(0);
  });

  it("no backfill percorre ate ao fim mesmo com itens ja conhecidos", async () => {
    // Sem isto um backfill interrompido nunca se completava: a pagina mais
    // recente ja estava em base e a corrida seguinte parava logo ali, deixando
    // o resto do historico por ler para sempre.
    const repo = fakeRepo({
      getState: vi.fn(async () => ({ backfillDone: false, backfillCursor: null })),
      knownExternalIds: vi.fn(async (_u, _k, ids: string[]) => new Set(ids.filter((id) => id === "1:1"))),
    });
    const client = fakeClient({ orders: [[orderItem(1, 1)], [orderItem(2, 2)]] });

    const report = await syncAll("u1", deps(client, repo));

    expect(report.stages.find((s) => s.kind === "orders")!.pages).toBe(2);
  });

  it("retoma o backfill no caminho guardado", async () => {
    const repo = fakeRepo({
      getState: vi.fn(async () => ({ backfillDone: false, backfillCursor: "/p?cursor=1" })),
    });
    const client = fakeClient({ orders: [[orderItem(1, 1)], [orderItem(2, 2)]] });

    const stage = (await syncAll("u1", deps(client, repo))).stages.find((s) => s.kind === "orders")!;

    expect(stage.pages).toBe(1);
    expect(stage.written).toBe(1);
  });

  it("guarda o caminho da pagina seguinte enquanto o backfill corre", async () => {
    const setState = vi.fn(async () => {});
    const repo = fakeRepo({
      setState,
      getState: vi.fn(async () => ({ backfillDone: false, backfillCursor: null })),
    });
    const client = fakeClient({ orders: [[orderItem(1, 1)], [orderItem(2, 2)]] });

    await syncAll("u1", deps(client, repo));

    expect(setState).toHaveBeenCalledWith("u1", "orders", expect.objectContaining({ backfillCursor: "/p?cursor=1" }));
  });

  it("marca o backfill como acabado quando chega ao fim", async () => {
    const setState = vi.fn(async () => {});
    const repo = fakeRepo({
      setState,
      getState: vi.fn(async () => ({ backfillDone: false, backfillCursor: null })),
    });
    const client = fakeClient({ orders: [[orderItem(1, 1)]] });

    await syncAll("u1", deps(client, repo));

    expect(setState).toHaveBeenCalledWith("u1", "orders", expect.objectContaining({ backfillDone: true, backfillCursor: null }));
  });

  it("uma segunda corrida sem novidades escreve zero", async () => {
    const repo = fakeRepo({ knownExternalIds: vi.fn(async (_u, _k, ids: string[]) => new Set(ids)) });
    const client = fakeClient({
      orders: [[orderItem(1, 1)]],
      dividends: [[dividendItem("d1")]],
      transactions: [[cashItem("c1")]],
    });

    const report = await syncAll("u1", deps(client, repo));

    // So as etapas de historico tem nocao de "novidade" (via knownExternalIds).
    // Positions e summary sao retrato inteiro a cada corrida -- reportam sempre
    // o que processaram, mesmo sem alteracoes, e isso nao e uma regressao.
    const history = report.stages.filter((s) =>
      ["orders", "dividends", "transactions"].includes(s.kind)
    );
    // Sem isto, um "kind" renomeado esvaziava o filtro e o every() seguinte
    // passava vazio -- o teste deixava de testar seja o que for.
    expect(history).toHaveLength(3);
    expect(history.every((s) => s.written === 0)).toBe(true);
    expect(report.stages.every((s) => s.ok)).toBe(true);
  });

  it("conta os itens saltados pelo Zod sem parar a etapa", async () => {
    const repo = fakeRepo();
    const client = fakeClient({ transactions: [[cashItem("c1"), { ...cashItem("c2"), type: "MISTERIO" }]] });

    const report = await syncAll("u1", deps(client, repo));
    const stage = report.stages.find((s) => s.kind === "transactions")!;

    expect(stage.skipped).toBe(1);
    expect(stage.written).toBe(1);
    expect(stage.ok).toBe(true);
  });

  it("uma etapa que falha nao impede as seguintes", async () => {
    const repo = fakeRepo({
      saveDividends: vi.fn(async () => { throw new Error("base em baixo"); }),
    });
    const client = fakeClient({
      orders: [[orderItem(1, 1)]],
      dividends: [[dividendItem("d1")]],
      transactions: [[cashItem("c1")]],
    });

    const report = await syncAll("u1", deps(client, repo));

    expect(report.stages.find((s) => s.kind === "dividends")!.ok).toBe(false);
    expect(report.stages.find((s) => s.kind === "dividends")!.error).toContain("base em baixo");
    expect(report.stages.find((s) => s.kind === "transactions")!.ok).toBe(true);
  });

  it("regista o erro da etapa no estado, para a interface o mostrar", async () => {
    const setState = vi.fn(async () => {});
    const repo = fakeRepo({ setState, saveOrders: vi.fn(async () => { throw new Error("falhou"); }) });
    const client = fakeClient({ orders: [[orderItem(1, 1)]] });

    await syncAll("u1", deps(client, repo));

    expect(setState).toHaveBeenCalledWith("u1", "orders", expect.objectContaining({ lastError: expect.stringContaining("falhou") }));
  });

  it("grava o retrato da carteira e o snapshot do dia", async () => {
    const repo = fakeRepo();
    const client = fakeClient({});

    await syncAll("u1", deps(client, repo));

    expect(repo.replaceHoldings).toHaveBeenCalledWith("u1", [expect.objectContaining({ ticker: "AAPL_US_EQ" })]);
    expect(repo.upsertSnapshot).toHaveBeenCalledWith("u1", expect.objectContaining({ date: "2026-08-25", invested: "400.00" }));
  });

  it("aplica a ponte no fim, com o corte derivado do Excel", async () => {
    // Parametros tipados de proposito: sem eles o vi.fn nao apanha a forma de
    // applyBridge por contexto, e mock.calls[0] fica com tupla vazia no tsc
    // (o vitest, via esbuild, nao denuncia -- so o tsc --noEmit apanha isto).
    const applyBridge = vi.fn(
      async (_userId: string, _plan: { toDelete: string[]; toCreate: unknown[] }) => ({
        created: 1,
        deleted: 0,
      })
    );
    const repo = fakeRepo({
      applyBridge,
      lastExcelMonth: vi.fn(async () => ({ year: 2026, month: 4 })),
      bridgeSource: vi.fn(async () => ({
        cashflows: [
          { externalId: "antes", dateTime: "2026-04-10T09:00:00Z", type: "DEPOSIT" as const, amount: "100.00" },
          { externalId: "depois", dateTime: "2026-06-10T09:00:00Z", type: "DEPOSIT" as const, amount: "200.00" },
        ],
        dividends: [],
      })),
    });

    await syncAll("u1", deps(fakeClient({}), repo));

    const plan = applyBridge.mock.calls[0][1] as { toCreate: { externalId: string }[] };
    expect(plan.toCreate.map((r) => r.externalId)).toEqual(["t212:depois"]);
  });

  it("nao substitui a carteira quando todos os itens saltaram no Zod", async () => {
    // Um campo renomeado pela T212 faz todos os itens saltar no parse. Antes
    // desta guarda, replaceHoldings([]) apagava a carteira real e a etapa
    // ainda reportava ok:true -- uma carteira desactualizada e muito melhor
    // do que uma carteira apagada.
    const repo = fakeRepo();
    const client = {
      request: vi.fn(async (path: string) => {
        if (path.includes("summary")) return summary;
        if (path.includes("positions")) return [{ campo: "renomeado" }];
        throw new Error(`caminho inesperado: ${path}`);
      }),
      paginate: fakeClient({}).paginate,
    };

    const report = await syncAll("u1", deps(client as unknown as ReturnType<typeof fakeClient>, repo));
    const positions = report.stages.find((s) => s.kind === "positions")!;

    expect(positions.ok).toBe(false);
    expect(positions.error).toBeTruthy();
    expect(repo.replaceHoldings).not.toHaveBeenCalled();
  });

  it("falha a etapa quando a paginacao para sem chegar ao fim do historico", async () => {
    // Simula o guarda contra ciclos do cliente real (t212.client.ts): a pagina
    // seguinte nunca chega a nextPagePath:null porque o gerador parou por
    // repetir um caminho ja visto. Sem esta deteccao, backfillDone fica falso
    // para sempre e cada corrida volta a reler o historico em silencio.
    const repo = fakeRepo({
      getState: vi.fn(async () => ({ backfillDone: false, backfillCursor: null })),
    });
    const client = {
      request: vi.fn(async (path: string) => {
        if (path.includes("summary")) return summary;
        if (path.includes("positions")) return [position];
        throw new Error(`caminho inesperado: ${path}`);
      }),
      paginate: async function* (path: string) {
        if (!path.includes("orders")) {
          yield { items: [], nextPagePath: null };
          return;
        }
        yield { items: [orderItem(1, 1)], nextPagePath: "/p?cursor=1" };
        // O gerador para aqui, tal como o guarda contra ciclos faria -- nunca
        // produz nextPagePath:null.
      },
    };

    const report = await syncAll("u1", deps(client as unknown as ReturnType<typeof fakeClient>, repo));
    const orders = report.stages.find((s) => s.kind === "orders")!;

    expect(orders.ok).toBe(false);
    expect(orders.error).toContain("paginacao terminou sem chegar ao fim do historico");
  });

  it("um setState que rejeita nao impede as etapas seguintes de correr", async () => {
    // O fakeRepo por omissao nunca rejeita, portanto o .catch(() => undefined)
    // do stage() nunca era exercitado -- e e exactamente a invariante que
    // garante que uma falha ao gravar estado nao trava a sincronizacao.
    const repo = fakeRepo({
      setState: vi.fn(async () => {
        throw new Error("syncstate indisponivel");
      }),
    });
    const client = fakeClient({
      orders: [[orderItem(1, 1)]],
      dividends: [[dividendItem("d1")]],
      transactions: [[cashItem("c1")]],
    });

    const report = await syncAll("u1", deps(client, repo));

    expect(report.stages).toHaveLength(6);
    expect(report.stages.find((s) => s.kind === "orders")!.written).toBe(1);
    expect(report.stages.find((s) => s.kind === "dividends")!.written).toBe(1);
    expect(report.stages.find((s) => s.kind === "transactions")!.written).toBe(1);
    expect(report.stages.find((s) => s.kind === "bridge")!.ok).toBe(true);
  });

  // Este teste ja afirmou o contrario: que a etapa bridge NAO gravava estado,
  // porque "bridge" nao existia no enum SyncKind. A consequencia era que a
  // unica etapa que mexe no orcamento podia falhar em todas as corridas
  // agendadas com as outras cinco verdes no painel e nada a dize-lo. O valor
  // passou a existir no enum e a excepcao saiu do stage().
  it("a etapa bridge grava estado como as outras", async () => {
    const setState = vi.fn(async () => {});
    const repo = fakeRepo({ setState });
    const client = fakeClient({});

    await syncAll("u1", deps(client, repo));

    expect(setState).toHaveBeenCalledWith(
      "u1",
      "bridge",
      expect.objectContaining({ lastRunAt: expect.any(Date), lastError: null })
    );
  });

  it("a etapa bridge que falha deixa o erro gravado, para o painel o mostrar", async () => {
    const setState = vi.fn(async () => {});
    const repo = fakeRepo({
      setState,
      applyBridge: vi.fn(async () => {
        throw new Error("categoria em falta");
      }),
    });

    const report = await syncAll("u1", deps(fakeClient({}), repo));

    expect(report.stages.find((s) => s.kind === "bridge")!.ok).toBe(false);
    expect(setState).toHaveBeenCalledWith(
      "u1",
      "bridge",
      expect.objectContaining({ lastError: expect.stringContaining("categoria em falta") })
    );
  });

  it("reporta os apagados da ponte, nao so os criados", async () => {
    // written:0, ok:true escondia quarenta transaccoes apagadas -- indistinguivel
    // de a ponte nao ter feito nada.
    const applyBridge = vi.fn(
      async (_userId: string, _plan: { toDelete: string[]; toCreate: unknown[] }) => ({
        created: 0,
        deleted: 40,
      })
    );
    const repo = fakeRepo({ applyBridge });
    const client = fakeClient({});

    const report = await syncAll("u1", deps(client, repo));
    const bridge = report.stages.find((s) => s.kind === "bridge")!;

    expect(bridge.deleted).toBe(40);
    expect(bridge.written).toBe(0);
  });
});
