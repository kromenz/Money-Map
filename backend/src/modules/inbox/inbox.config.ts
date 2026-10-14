import { decodeKey } from "./inbox.crypto";

export type InboxConfig = {
  configured: boolean;
  /** Sem barra no fim; as rotas comecam por /api/. */
  url: string;
  desktopToken: string;
  key: Uint8Array | null;
  /** Entre idas a caixa enquanto o stack esta ligado. */
  intervalMinutes: number;
};

/**
 * https, ou http so para a propria maquina (o wrangler dev). O token do
 * desktop vai no cabecalho de cada pedido: por http ate um Worker publicado
 * viajava em claro.
 */
function isSafeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") return true;
  return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
}

/**
 * Como o T212: sem configuracao, nada liga e o resto da app fica igual. Uma
 * variavel mal escrita conta como em falta -- e melhor o modulo nao arrancar
 * do que arrancar contra uma URL ou uma chave que nao sao as do telemovel.
 */
export function loadInboxConfig(env: NodeJS.ProcessEnv = process.env): InboxConfig {
  const url = (env.INBOX_URL ?? "").trim().replace(/\/+$/, "");
  const desktopToken = (env.INBOX_DESKTOP_TOKEN ?? "").trim();
  const key = decodeKey(env.INBOX_KEY ?? "");

  return {
    configured: isSafeUrl(url) && desktopToken !== "" && key !== null,
    url,
    desktopToken,
    key,
    intervalMinutes: 5,
  };
}
