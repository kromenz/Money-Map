import { RequestHandler } from "express";
import { importBudgetWorkbook } from "./budget.service";
import { importQuerySchema, gridQuerySchema } from "./budget.schemas";
import { buildGrid } from "./budget.grid";

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

    // 422 quando os totais nao batem: o import fica gravado, mas o cliente
    // tem de saber que o resultado nao reproduz a folha.
    res.status(result.allMatch ? 200 : 422).json(result);
  } catch (err) {
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
