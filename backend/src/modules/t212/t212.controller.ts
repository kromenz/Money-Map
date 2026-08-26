import { RequestHandler } from "express";
import { loadT212Config } from "./t212.config";
import { runSyncNow, SyncInProgressError } from "./t212.scheduler";
import {
  getCashFlows,
  getChart,
  getDividends,
  getOrders,
  getOverview,
  getSheetPending,
  markSheetWritten,
} from "./t212.service";
import {
  dividendsQuerySchema,
  listQuerySchema,
  ordersQuerySchema,
  sheetWrittenSchema,
} from "./t212.http.schemas";

/**
 * O overview responde sempre, com configured: false -- e o que permite a pagina
 * mostrar as instrucoes de configuracao em vez de um erro. As restantes rotas
 * dizem 503, porque sem chave nao ha nada para servir.
 */
export const guardConfigured: RequestHandler = (req, res, next) => {
  if (loadT212Config().configured) {
    next();
    return;
  }
  res.status(503).json({
    error: "Trading 212 nao configurado. Falta T212_API_KEY em backend/.env",
  });
};

export const overview: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getOverview((req as any).userId));
  } catch (err) {
    next(err);
  }
};

export const chart: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getChart((req as any).userId));
  } catch (err) {
    next(err);
  }
};

export const dividends: RequestHandler = async (req, res, next) => {
  try {
    const parsed = dividendsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Ano invalido" });
      return;
    }
    res.json(await getDividends((req as any).userId, parsed.data.year));
  } catch (err) {
    next(err);
  }
};

export const orders: RequestHandler = async (req, res, next) => {
  try {
    const parsed = ordersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Filtros invalidos" });
      return;
    }
    res.json(await getOrders((req as any).userId, parsed.data));
  } catch (err) {
    next(err);
  }
};

export const cashflows: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Filtros invalidos" });
      return;
    }
    res.json(await getCashFlows((req as any).userId, parsed.data));
  } catch (err) {
    next(err);
  }
};

export const syncNow: RequestHandler = async (req, res, next) => {
  try {
    // 200 mesmo com etapas falhadas: sucesso parcial e um resultado, e o
    // relatorio diz exactamente o que correu mal em cada uma.
    res.json(await runSyncNow((req as any).userId));
  } catch (err) {
    // 409 e nao 500: nada correu mal, so ja ha uma corrida a fazer o trabalho.
    // O limite de pedidos da T212 e por conta, portanto duas corridas em
    // paralelo queimavam-no uma contra a outra.
    if (err instanceof SyncInProgressError) {
      res.status(409).json({
        error:
          "Ja esta uma sincronizacao a decorrer. Espere que termine antes de pedir outra.",
      });
      return;
    }
    next(err);
  }
};

/**
 * O que a ponte ainda deve a folha, e o registo do que ela aceitou.
 *
 * Sem guardConfigured de proposito: as linhas da ponte sobrevivem a chave ser
 * retirada do .env, e nesse caso continuam a ter de poder chegar a folha. O
 * que estas rotas leem esta todo na base -- nao tocam na API da corretora.
 */
export const sheetPending: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getSheetPending((req as any).userId));
  } catch (err) {
    next(err);
  }
};

export const sheetWritten: RequestHandler = async (req, res, next) => {
  try {
    const parsed = sheetWrittenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Lista de escritas invalida" });
      return;
    }
    res.json(await markSheetWritten((req as any).userId, parsed.data.written));
  } catch (err) {
    next(err);
  }
};
