import { prisma } from "../../db/prisma";

export async function getAlltokens() {
  return await prisma.refreshToken.findMany();
}

export async function getTokensByUserId(userId: string) {
  return await prisma.refreshToken.findMany({ where: { userId } });
}
