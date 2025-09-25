import { Request, Response } from "express";
import { prisma } from "../../db/prisma";

export async function getMe(req: Request, res: Response) {
  const userId = (req as any).userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  res.json(user);
}

export async function getAllUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true },
  });
  res.json(users);
}
