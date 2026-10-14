import { RequestHandler } from "express";
import { loadInboxConfig } from "./inbox.config";
import { runInboxSync } from "./inbox.service";
import { createInboxClient } from "./inbox.client";
import { hashToken, newDeviceToken, pairingUrl } from "./inbox.pairing";

export const guardInboxConfigured: RequestHandler = (req, res, next) => {
  if (loadInboxConfig().configured) {
    next();
    return;
  }
  // configured: false deixa o dashboard calar-se sem ler a mensagem.
  res.status(503).json({
    error:
      "Caixa do telemovel nao configurada. Faltam INBOX_URL, INBOX_DESKTOP_TOKEN ou INBOX_KEY em backend/.env",
    configured: false,
  });
};

export const syncInbox: RequestHandler = async (req, res) => {
  try {
    res.json(await runInboxSync((req as any).userId));
  } catch (err) {
    // 502 e nao 500: quem falhou foi a caixa (rede, Worker), nao este servidor.
    console.warn("[inbox] sincronizacao falhou", err);
    res.status(502).json({ error: "the phone inbox could not be reached" });
  }
};

/** POST porque cria um dispositivo: um GET repetido pelo browser criava varios. */
export const pairPhone: RequestHandler = async (req, res, next) => {
  try {
    const config = loadInboxConfig();
    const token = newDeviceToken();
    await createInboxClient(config).registerDevice(hashToken(token), "iPhone");
    res.json({ url: pairingUrl(config.url, config.key!, token) });
  } catch (err) {
    next(err);
  }
};
