import { RequestHandler } from "express";
import { importBudgetWorkbook, previewBudgetWorkbook } from "./budget.service";
import { listYears } from "./budget.years";
import {
  importQuerySchema,
  gridQuerySchema,
  pendingBodySchema,
  clearBodySchema,
} from "./budget.schemas";
import { buildGrid } from "./budget.grid";
import { WorkbookFormatError } from "./budget.parser";
import { addPending, listPending, clearPending } from "./budget.pending";

export const importWorkbook: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const file = (req as any).file as { buffer: Buffer } | undefined;

    if (!file) {
      res.status(400).json({ error: "Falta o ficheiro no campo 'file'" });
      return;
    }

    const parsedQuery = importQuerySchema.safeParse({
      year: req.body?.year ?? req.query?.year,
    });
    if (!parsedQuery.success) {
      res.status(400).json({
        error: "Ano invalido",
        issues: parsedQuery.error.issues.map((i) => i.message),
      });
      return;
    }

    const result = await importBudgetWorkbook(
      userId,
      file.buffer,
      parsedQuery.data.year
    );

    // 422 quando os totais nao batem: nada foi gravado -- a transacao reverteu
    // -- e o relatorio diz ao cliente que escopos e que nao reproduzem a folha.
    res.status(result.allMatch ? 200 : 422).json(result);
  } catch (err) {
    if (err instanceof WorkbookFormatError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
};

export const getGrid: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    const parsed = gridQuerySchema.safeParse({ year: req.query.year });
    if (!parsed.success) {
      res.status(400).json({
        error: "Ano invalido",
        issues: parsed.error.issues.map((i) => i.message),
      });
      return;
    }

    res.json(await buildGrid(userId, parsed.data.year));
  } catch (err) {
    next(err);
  }
};

export const previewWorkbook: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const file = (req as any).file as { buffer: Buffer } | undefined;

    if (!file) {
      res.status(400).json({ error: "Falta o ficheiro no campo 'file'" });
      return;
    }

    const parsedQuery = importQuerySchema.safeParse({
      year: req.body?.year ?? req.query?.year,
    });
    if (!parsedQuery.success) {
      res.status(400).json({
        error: "Ano invalido",
        issues: parsedQuery.error.issues.map((i) => i.message),
      });
      return;
    }

    res.json(
      await previewBudgetWorkbook(userId, file.buffer, parsedQuery.data.year)
    );
  } catch (err) {
    if (err instanceof WorkbookFormatError) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
};

export const getYears: RequestHandler = async (req, res, next) => {
  try {
    res.json({ years: await listYears((req as any).userId) });
  } catch (err) {
    next(err);
  }
};

export const queuePending: RequestHandler = async (req, res, next) => {
  try {
    const parsed = pendingBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Pendente invalido",
        issues: parsed.error.issues.map((i) => i.message),
      });
      return;
    }

    const row = await addPending((req as any).userId, parsed.data);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

export const getPending: RequestHandler = async (req, res, next) => {
  try {
    res.json({ pending: await listPending((req as any).userId) });
  } catch (err) {
    next(err);
  }
};

export const clearPendingHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = clearBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Lista de ids invalida" });
      return;
    }

    const cleared = await clearPending((req as any).userId, parsed.data.ids);
    res.json({ cleared });
  } catch (err) {
    next(err);
  }
};
