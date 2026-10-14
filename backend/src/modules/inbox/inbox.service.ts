import { loadInboxConfig, type InboxConfig } from "./inbox.config";
import { importKey, seal } from "./inbox.crypto";
import { pullInbox, type PullFailure } from "./inbox.pull";
import { alreadyReceived, receiverFor } from "./inbox.receipts";
import { createInboxClient, type InboxClient } from "./inbox.client";
import { buildCatalog, type Catalog } from "./inbox.catalog";

export type InboxSyncResult = {
  received: number;
  failures: PullFailure[];
  catalogPushed: boolean;
};

export type InboxServiceDeps = {
  config: InboxConfig;
  client: InboxClient;
  alreadyReceived: (sourceId: string) => Promise<boolean>;
  receiverFor: typeof receiverFor;
  buildCatalog: (userId: string) => Promise<Catalog>;
};

export class InboxNotConfiguredError extends Error {
  constructor() {
    super("A caixa do telemovel nao esta configurada (INBOX_URL, INBOX_DESKTOP_TOKEN, INBOX_KEY)");
    this.name = "InboxNotConfiguredError";
  }
}

function realDeps(overrides: Partial<InboxServiceDeps>): InboxServiceDeps {
  const config = overrides.config ?? loadInboxConfig();
  return {
    config,
    client: overrides.client ?? createInboxClient(config),
    alreadyReceived: overrides.alreadyReceived ?? alreadyReceived,
    receiverFor: overrides.receiverFor ?? receiverFor,
    buildCatalog: overrides.buildCatalog ?? ((userId) => buildCatalog(userId)),
  };
}

/**
 * A corrida em curso, partilhada. O tick e o dashboard podem pedir ao mesmo
 * tempo; em vez de recusar o segundo (como o T212 faz com 409), o segundo
 * espera pela mesma -- o dashboard quer o numero do que chegou, e esse
 * numero e o da corrida que ja vai a meio.
 */
let inFlight: Promise<InboxSyncResult> | null = null;

export function runInboxSync(
  userId: string,
  // Existe para os testes correrem sem rede nem base. As rotas e o tick nunca
  // passam nada.
  overrides: Partial<InboxServiceDeps> = {}
): Promise<InboxSyncResult> {
  if (inFlight) return inFlight;

  const run = (async (): Promise<InboxSyncResult> => {
    const deps = realDeps(overrides);
    if (!deps.config.configured || !deps.config.key) throw new InboxNotConfiguredError();
    const key = await importKey(deps.config.key);

    const report = await pullInbox({
      key,
      list: () => deps.client.list(),
      remove: (id) => deps.client.remove(id),
      alreadyReceived: deps.alreadyReceived,
      receive: deps.receiverFor(userId),
    });

    // Depois do pull e fora dele: um catalogo que nao sobe deixa o telemovel
    // com as categorias de ontem, mas nao pode estragar o que chegou.
    let catalogPushed = false;
    try {
      const blob = await seal(key, await deps.buildCatalog(userId), "catalog");
      await deps.client.putCatalog(blob);
      catalogPushed = true;
    } catch (err) {
      console.warn("[inbox] o catalogo nao subiu", err);
    }

    return { ...report, catalogPushed };
  })();

  inFlight = run;
  // Limpa so se ainda for esta: o finally de uma corrida velha nao pode
  // apagar a referencia de uma nova.
  run
    .finally(() => {
      if (inFlight === run) inFlight = null;
    })
    .catch(() => undefined);

  return run;
}

/**
 * Depois de uma importacao aceite, as categorias podem ter mudado. Silencioso:
 * a importacao ja respondeu ao utilizador, e o tick seguinte volta a tentar.
 */
export async function pushCatalogQuietly(userId: string): Promise<void> {
  const config = loadInboxConfig();
  if (!config.configured || !config.key) return;
  try {
    const key = await importKey(config.key);
    const blob = await seal(key, await buildCatalog(userId), "catalog");
    await createInboxClient(config).putCatalog(blob);
  } catch (err) {
    console.warn("[inbox] o catalogo nao subiu depois da importacao", err);
  }
}
