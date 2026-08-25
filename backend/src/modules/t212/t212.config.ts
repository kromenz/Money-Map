export type T212Config = {
  configured: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  syncIntervalHours: number;
  bridgeFrom: string | null;
};

const LIVE = "https://live.trading212.com";
const DEMO = "https://demo.trading212.com";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O baseUrl e so a origem. Os caminhos incluem /api/v0/... porque e assim que
 * o nextPagePath vem na resposta -- guardar o prefixo aqui obrigava a corta-lo
 * outra vez a cada pagina.
 */
export function loadT212Config(
  env: NodeJS.ProcessEnv = process.env
): T212Config {
  const apiKey = env.T212_API_KEY ?? "";
  const hours = Number(env.T212_SYNC_INTERVAL_HOURS);
  const bridgeFrom = env.T212_BRIDGE_FROM ?? "";

  return {
    configured: apiKey.length > 0,
    baseUrl: env.T212_ENV === "demo" ? DEMO : LIVE,
    apiKey,
    apiSecret: env.T212_API_SECRET ?? "",
    syncIntervalHours: Number.isFinite(hours) && hours > 0 ? hours : 6,
    bridgeFrom: ISO_DATE.test(bridgeFrom) ? bridgeFrom : null,
  };
}
