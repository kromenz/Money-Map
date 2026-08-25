import type { T212Config } from "./t212.config";

export const PATHS = {
  summary: "/api/v0/equity/account/summary",
  positions: "/api/v0/equity/positions",
  orders: "/api/v0/equity/history/orders",
  dividends: "/api/v0/equity/history/dividends",
  transactions: "/api/v0/equity/history/transactions",
  instruments: "/api/v0/equity/metadata/instruments",
} as const;

export class T212Error extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "T212Error";
  }
}

export type T212Deps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export function basicAuth(apiKey: string, apiSecret: string): string {
  return "Basic " + Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

type PageResponse = { items?: unknown[]; nextPagePath?: string | null };

/**
 * O x-ratelimit-reset vem como instante unix em segundos; now() esta em
 * milissegundos. A espera e sempre a diferenca entre os dois, convertida
 * para milissegundos -- sem heuristica de "sera que isto e relativo", que so
 * inventava casos que a API nao documenta e desalinhava a conta.
 */
function resetToMs(reset: number, now: number): number {
  if (!Number.isFinite(reset)) return 0;
  return reset * 1000 - now;
}

/**
 * Espera minima quando um 429 nao vem com x-ratelimit-reset nem com
 * x-ratelimit-period: 5s e a janela do endpoint mais restritivo que
 * consumimos (/account/summary, 1 pedido por 5s), por isso esperar isso
 * chega para qualquer outro endpoint tambem -- nenhum e mais apertado.
 */
const DEFAULT_BACKOFF_MS = 5_000;

export class T212Client {
  private nextAllowedAt = 0;

  constructor(
    private readonly cfg: { baseUrl: string; apiKey: string; apiSecret: string },
    private readonly deps: T212Deps
  ) {}

  async request<T>(pathWithQuery: string): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.gate();

      const res = await this.deps.fetch(this.cfg.baseUrl + pathWithQuery, {
        headers: {
          Authorization: basicAuth(this.cfg.apiKey, this.cfg.apiSecret),
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        this.noteReset(res);
        continue;
      }

      if (!res.ok) throw new T212Error(await describe(res), res.status);

      this.noteRemaining(res);
      return (await res.json()) as T;
    }

    throw new T212Error(
      "Limite de pedidos excedido duas vezes seguidas",
      429
    );
  }

  /**
   * Devolve o nextPagePath com cada pagina: e o que o backfill guarda para
   * retomar de onde ficou, e passar `cursor` no query e o que permite recomecar
   * la.
   */
  async *paginate(
    path: string,
    query: Record<string, string | number> = {},
    startPath: string | null = null
  ): AsyncGenerator<{ items: unknown[]; nextPagePath: string | null }> {
    const params = new URLSearchParams({ limit: "50" });
    for (const [k, v] of Object.entries(query)) params.set(k, String(v));

    // A primeira pagina monta-se aqui; as seguintes vem prontas no
    // nextPagePath, que ja traz cursor e limit. O startPath e um nextPagePath
    // guardado de uma corrida anterior -- retomar e so pedi-lo outra vez.
    let next: string | null = startPath ?? `${path}?${params.toString()}`;

    // Salvaguarda contra a API, nao contra nos: se o nextPagePath devolvido
    // apontar para um caminho ja pedido nesta iteracao, isto e um backfill em
    // pano de fundo contra um endpoint com limites por conta -- ciclar para
    // sempre e o pior desfecho possivel, por isso paramos em vez disso.
    const seen = new Set<string>();

    while (next && !seen.has(next)) {
      seen.add(next);
      // Anotacoes explicitas aqui evitam um TS7022: sem elas o compilador
      // enreda-se a inferir o tipo de "page" a partir do proprio generator
      // que o consome, e declara-o circular.
      const page: PageResponse = await this.request<PageResponse>(next);
      const nextPagePath: string | null = page.nextPagePath ?? null;
      yield { items: page.items ?? [], nextPagePath };
      next = nextPagePath;
    }
  }

  private async gate(): Promise<void> {
    const wait = this.nextAllowedAt - this.deps.now();
    if (wait > 0) await this.deps.sleep(wait);
    this.nextAllowedAt = 0;
  }

  private noteRemaining(res: Response): void {
    // Number(null) e 0, igual a um header que diga "0" -- sem o has(), uma
    // resposta que simplesmente nao manda x-ratelimit-remaining seria lida
    // como limite esgotado e impunha uma espera que ninguem pediu.
    if (!res.headers.has("x-ratelimit-remaining")) return;
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    if (!Number.isFinite(remaining) || remaining > 0) return;
    const now = this.deps.now();
    this.nextAllowedAt = now + resetToMs(Number(res.headers.get("x-ratelimit-reset")), now);
  }

  private noteReset(res: Response): void {
    const now = this.deps.now();
    this.nextAllowedAt =
      now +
      (res.headers.has("x-ratelimit-reset")
        ? resetToMs(Number(res.headers.get("x-ratelimit-reset")), now)
        : this.fallbackBackoffMs(res));
  }

  /**
   * Sem x-ratelimit-reset, um 429 nao pode ficar com espera nenhuma -- seria
   * bater outra vez no mesmo instante contra um endpoint que acabou de
   * recusar, queimando a unica retentativa que ha. x-ratelimit-period (em
   * segundos) diz a janela do proprio endpoint quando vem; sem ele tambem,
   * cai no DEFAULT_BACKOFF_MS.
   */
  private fallbackBackoffMs(res: Response): number {
    if (res.headers.has("x-ratelimit-period")) {
      const period = Number(res.headers.get("x-ratelimit-period"));
      if (Number.isFinite(period)) return period * 1000;
    }
    return DEFAULT_BACKOFF_MS;
  }
}

async function describe(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  if (res.status === 401) {
    return `Chave do Trading 212 recusada (401). ${body}`.trim();
  }
  if (res.status === 403) {
    // O corpo diz "Scope( history:orders ) missing for API key" -- e a
    // informacao que resolve o problema, portanto sobe intacta.
    return `Permissao em falta na chave (403). ${body}`.trim();
  }
  return `Trading 212 respondeu ${res.status}. ${body}`.trim();
}

export function createClient(
  cfg: T212Config,
  deps: Partial<T212Deps> = {}
): T212Client {
  return new T212Client(cfg, {
    fetch: deps.fetch ?? fetch,
    sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: deps.now ?? Date.now,
  });
}
