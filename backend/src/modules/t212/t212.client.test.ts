import { describe, it, expect, vi } from "vitest";
import { T212Client, T212Error, basicAuth, PATHS } from "./t212.client";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function make(fetchImpl: typeof fetch, now = () => 1_000_000) {
  const sleep = vi.fn(async () => {});
  const client = new T212Client(
    { baseUrl: "https://demo.trading212.com", apiKey: "k", apiSecret: "s" },
    { fetch: fetchImpl, sleep, now }
  );
  return { client, sleep };
}

describe("basicAuth", () => {
  it("poe a chave como utilizador e o secret como palavra-passe", () => {
    expect(basicAuth("k", "s")).toBe("Basic " + Buffer.from("k:s").toString("base64"));
  });
});

describe("T212Client.request", () => {
  it("chama o baseUrl mais o caminho e envia o Basic", async () => {
    // Parametros tipados aqui (nao so no site do TS2493) porque esta chamada
    // tambem indexa mock.calls -- sem eles o vi.fn() infere zero argumentos.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ totalValue: 1 }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    await client.request(PATHS.summary);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://demo.trading212.com/api/v0/equity/account/summary");
    expect((init.headers as Record<string, string>).Authorization).toBe(basicAuth("k", "s"));
  });

  it("da um erro legivel no 401", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 401 }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    await expect(client.request(PATHS.summary)).rejects.toMatchObject({ status: 401 });
  });

  it("no 403 diz qual e o scope que falta", async () => {
    const fetchMock = vi.fn(async () =>
      new Response("Scope( history:orders ) missing for API key", { status: 403 })
    );
    const { client } = make(fetchMock as unknown as typeof fetch);

    await expect(client.request(PATHS.orders)).rejects.toThrow(/history:orders/);
  });

  it("espera antes do pedido seguinte quando o limite esgota", async () => {
    // reset vem em segundos desde a epoca; now() esta em milissegundos.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }, { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1005" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await client.request(PATHS.summary);
    expect(sleep).not.toHaveBeenCalled();

    await client.request(PATHS.summary);
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("recua no 429 e tenta uma segunda vez", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "x-ratelimit-reset": "1030" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await expect(client.request(PATHS.positions)).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("desiste depois do segundo 429 em vez de martelar a API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, { status: 429, headers: { "x-ratelimit-reset": "1001" } }));
    const { client } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await expect(client.request(PATHS.positions)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // Ronda de fix 1 -- Important 1: Number(null) e 0, igual a um header que
  // diga "0". Sem distinguir "ausente" de "esgotado" com headers.has(), um
  // 200 que simplesmente nao manda x-ratelimit-remaining era lido como
  // limite esgotado.
  it("200 sem nenhum dos dois headers de limite nao espera no pedido seguinte", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: 1 }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch);

    await client.request(PATHS.summary);
    await client.request(PATHS.summary);

    expect(sleep).not.toHaveBeenCalled();
  });

  it("200 com x-ratelimit-reset mas sem x-ratelimit-remaining nao espera -- e o defeito que o Important 1 corrige", async () => {
    // Diferente do teste anterior: aqui ha um x-ratelimit-reset valido e
    // grande, por isso este teste falha mesmo sem a correcao (o anterior,
    // com os dois headers ausentes, calha a dar wait<=0 nos dois casos por
    // coincidencia aritmetica e nao apanhava sozinho este defeito).
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }, { headers: { "x-ratelimit-reset": "1005" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await client.request(PATHS.summary);
    await client.request(PATHS.summary);

    expect(sleep).not.toHaveBeenCalled();
  });

  it("200 com x-ratelimit-remaining a 0 continua a provocar espera no pedido seguinte", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }, { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1005" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await client.request(PATHS.summary);
    await client.request(PATHS.summary);

    expect(sleep).toHaveBeenCalledWith(5000);
  });

  // Ronda de fix 1 -- Important 2: um 429 sem x-ratelimit-reset dava
  // nextAllowedAt = 0 e portanto retentativa imediata -- nao e recuo
  // nenhum, e queima a unica retentativa que ha.
  it("429 sem x-ratelimit-reset e sem x-ratelimit-period espera 5s (DEFAULT_BACKOFF_MS) antes da segunda tentativa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await expect(client.request(PATHS.positions)).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it("429 sem x-ratelimit-reset mas com x-ratelimit-period usa essa janela como espera", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "x-ratelimit-period": "60" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { client, sleep } = make(fetchMock as unknown as typeof fetch, () => 1_000_000);

    await expect(client.request(PATHS.positions)).resolves.toEqual({ ok: true });
    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  // Ronda de fix 1 -- Minor 4: nextAllowedAt chamava this.deps.now() duas
  // vezes na mesma expressao. Contar as chamadas ao mock prova que agora e
  // so uma: gate() antes de cada tentativa mais uma unica chamada dentro do
  // metodo que calcula a proxima janela.
  it("noteReset so consulta now() uma vez para calcular a proxima janela", async () => {
    const nowMock = vi.fn(() => 1_000_000);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "x-ratelimit-reset": "1030" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { client } = make(fetchMock as unknown as typeof fetch, nowMock);

    await client.request(PATHS.positions);

    // gate() da 1a tentativa + noteReset + gate() da 2a tentativa = 3.
    // Duas chamadas a now() dentro do noteReset davam 4 em vez de 3.
    expect(nowMock).toHaveBeenCalledTimes(3);
  });

  it("noteRemaining so consulta now() uma vez para calcular a proxima janela", async () => {
    const nowMock = vi.fn(() => 1_000_000);
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ok: 1 }, { headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1005" } })
    );
    const { client } = make(fetchMock as unknown as typeof fetch, nowMock);

    await client.request(PATHS.summary);

    // gate() + noteRemaining = 2. Duas chamadas a now() dentro do
    // noteRemaining davam 3 em vez de 2.
    expect(nowMock).toHaveBeenCalledTimes(2);
  });
});

describe("T212Client.paginate", () => {
  it("segue o nextPagePath ate vir null", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [{ reference: "a" }], nextPagePath: "/api/v0/equity/history/transactions?cursor=2&limit=50" }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ reference: "b" }], nextPagePath: null }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const pages: { items: unknown[]; nextPagePath: string | null }[] = [];
    for await (const page of client.paginate(PATHS.transactions)) pages.push(page);

    expect(pages.map((p) => p.items)).toEqual([[{ reference: "a" }], [{ reference: "b" }]]);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=50");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://demo.trading212.com/api/v0/equity/history/transactions?cursor=2&limit=50"
    );
  });

  it("cada pagina traz o nextPagePath -- e o que o backfill guarda para retomar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [], nextPagePath: "/api/v0/equity/history/orders?cursor=9&limit=50" }))
      .mockResolvedValueOnce(jsonResponse({ items: [], nextPagePath: null }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const pages: { nextPagePath: string | null }[] = [];
    for await (const page of client.paginate(PATHS.orders)) pages.push(page);

    expect(pages[0].nextPagePath).toContain("cursor=9");
    expect(pages[1].nextPagePath).toBeNull();
  });

  it("comeca no caminho guardado, para retomar um backfill interrompido", async () => {
    // vi.fn(async () => ...) sem parametros infere assinatura de zero
    // argumentos, o que torna mock.calls[0][0] um acesso a um tuplo vazio
    // (TS2493). Declarar os parametros que o fetch recebe corrige o tipo
    // sem mudar o que o mock faz.
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [], nextPagePath: null }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const guardado = "/api/v0/equity/history/orders?cursor=77&limit=50";
    for await (const _page of client.paginate(PATHS.orders, {}, guardado)) break;

    expect(fetchMock.mock.calls[0][0]).toBe("https://demo.trading212.com" + guardado);
  });

  // Este teste ja afirmou o contrario: que uma resposta sem `items` nao
  // rebentava e valia como pagina vazia. Isso era exactamente o modo de falha
  // silencioso que a validacao do envelope veio fechar -- um campo renomeado
  // pela T212 dava uma pagina vazia sem pagina seguinte, o backfill dava-se por
  // concluido com zero linhas e o historico nunca mais era lido.
  it("uma resposta sem items rebenta, em vez de valer como fim do historico", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ nextPagePath: null }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const consumir = async () => {
      for await (const _page of client.paginate(PATHS.dividends)) break;
    };

    await expect(consumir()).rejects.toThrow(/items/);
  });

  it("a mensagem do envelope invalido nomeia o caminho pedido", async () => {
    // Sem o caminho na mensagem, o painel de estado dizia so que a forma mudou
    // -- nao em que endpoint, que e o unico dado que resolve o problema.
    const fetchMock = vi.fn(async () => jsonResponse({ items: "nao e um array", nextPagePath: null }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const consumir = async () => {
      for await (const _page of client.paginate(PATHS.orders)) break;
    };

    await expect(consumir()).rejects.toThrow(/history\/orders/);
  });

  it("um nextPagePath ausente tambem rebenta -- terminaria o backfill em silencio", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ items: [] }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const consumir = async () => {
      for await (const _page of client.paginate(PATHS.transactions)) break;
    };

    await expect(consumir()).rejects.toThrow(/nextPagePath/);
  });

  // Ronda de fix 1 -- Minor 3: salvaguarda contra a API, nao contra nos. Um
  // nextPagePath que aponte para um caminho ja pedido faria o gerador pedir
  // para sempre contra um endpoint com limites por conta.
  it("nextPagePath que aponta para o caminho acabado de pedir termina a iteracao em vez de ciclar", async () => {
    const loopPath = "/api/v0/equity/history/orders?limit=50";
    const fetchMock = vi.fn(async () => jsonResponse({ items: [{ x: 1 }], nextPagePath: loopPath }));
    const { client } = make(fetchMock as unknown as typeof fetch);

    const pages: { items: unknown[] }[] = [];
    for await (const page of client.paginate(PATHS.orders)) {
      pages.push(page);
      // Salvaguarda do proprio teste: sem o guarda de producao isto ciclava
      // para sempre. Este limite so existe para o teste falhar depressa
      // (pages.length !== 1) em vez de nunca terminar.
      if (pages.length > 5) break;
    }

    expect(pages.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
