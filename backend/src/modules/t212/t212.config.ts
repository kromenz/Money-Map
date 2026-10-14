export type T212Config = {
  configured: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  /** Entre sincronizacoes automaticas. Por omissao seis horas. */
  syncIntervalMinutes: number;
  bridgeFrom: string | null;
  userEmail: string | null;
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
  const bridgeFrom = env.T212_BRIDGE_FROM ?? "";

  return {
    configured: apiKey.length > 0,
    baseUrl: env.T212_ENV === "demo" ? DEMO : LIVE,
    apiKey,
    apiSecret: env.T212_API_SECRET ?? "",
    syncIntervalMinutes: syncIntervalMinutes(env),
    bridgeFrom: ISO_DATE.test(bridgeFrom) ? bridgeFrom : null,
    userEmail: env.T212_USER_EMAIL ? env.T212_USER_EMAIL : null,
  };
}

/**
 * Minutos ganham a horas. A variavel em horas e a original e os .env que ja
 * existem usam-na; a de minutos nasceu quando um minuto em horas (0.0167) se
 * tornou o valor que se queria escrever. Um valor que nao e um numero positivo
 * conta como ausente, e nao como zero -- zero era um setInterval a disparar
 * sem parar contra o limite da conta.
 */
function syncIntervalMinutes(env: NodeJS.ProcessEnv): number {
  const minutes = Number(env.T212_SYNC_INTERVAL_MINUTES);
  if (Number.isFinite(minutes) && minutes > 0) return minutes;
  const hours = Number(env.T212_SYNC_INTERVAL_HOURS);
  if (Number.isFinite(hours) && hours > 0) return hours * 60;
  return 6 * 60;
}