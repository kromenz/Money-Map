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

    while (next) {
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
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    if (!Number.isFinite(remaining) || remaining > 0) return;
    this.nextAllowedAt =
      this.deps.now() +
      resetToMs(Number(res.headers.get("x-ratelimit-reset")), this.deps.now());
  }

  private noteReset(res: Response): void {
    this.nextAllowedAt =
      this.deps.now() +
      resetToMs(Number(res.headers.get("x-ratelimit-reset")), this.deps.now());
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
