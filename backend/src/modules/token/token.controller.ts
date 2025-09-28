import { RequestHandler } from "express";
import * as service from "./token.service";
import { prisma } from "../../db/prisma";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getTokenByUserId: RequestHandler = async (req, res, next) => {
  try {
    const authUserId = (req as any).userId as string | undefined;

    const bodyUserId = req.body?.userId ? String(req.body.userId) : undefined;
    const paramUserId = req.params?.id ? String(req.params.id) : undefined;
    const queryUserId = req.query?.userId
      ? String(req.query.userId)
      : undefined;

    const userId = authUserId ?? paramUserId ?? bodyUserId ?? queryUserId;

    if (!userId) {
      res
        .status(400)
        .json({ error: "Missing userId (send in token, params or body)" });
      return;
    }

    if (!uuidRegex.test(userId)) {
      res.status(400).json({ error: "Invalid userId format (must be UUID)" });
      return;
    }

    const user = await service.getTokensByUserId(userId);
    res.json(user);
    return;
  } catch (err) {
    return next(err);
  }
};
