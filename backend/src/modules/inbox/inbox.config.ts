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
 * Como o T212: sem configuracao, nada liga e o resto da app fica igual. Uma
 * variavel mal escrita conta como em falta -- e melhor o modulo nao arrancar
 * do que arrancar contra uma URL ou uma chave que nao sao as do telemovel.
 */
export function loadInboxConfig(env: NodeJS.ProcessEnv = process.env): InboxConfig {
  const url = (env.INBOX_URL ?? "").trim().replace(/\/+$/, "");
  const desktopToken = (env.INBOX_DESKTOP_TOKEN ?? "").trim();
  const key = decodeKey(env.INBOX_KEY ?? "");

  return {
    configured: /^https?:\/\/[^/]+/.test(url) && desktopToken !== "" && key !== null,
    url,
    desktopToken,
    key,
    intervalMinutes: 5,
  };
}
