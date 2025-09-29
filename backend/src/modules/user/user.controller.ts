import { RequestHandler } from "express";
import * as service from "./user.service";
import { prisma } from "../../db/prisma";

export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const param =
      (req as any).param ??
      req.params?.id ??
      req.body?.param ??
      req.query?.param;

    if (!param) {
      res.status(400).json({ error: "Missing identifier" });
      return;
    }

    const user = await service.getUser(param);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const getAllUsers: RequestHandler = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    return next(err);
  }
};
