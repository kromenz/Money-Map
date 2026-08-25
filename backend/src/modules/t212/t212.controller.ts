import { RequestHandler } from "express";
import { loadT212Config } from "./t212.config";
import { runSyncNow } from "./t212.scheduler";
import { getCashFlows, getChart, getDividends, getOrders, getOverview } from "./t212.service";
import { dividendsQuerySchema, listQuerySchema, ordersQuerySchema } from "./t212.http.schemas";

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
    next(err);
  }
};
