import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export type PendingRow = {
  id: string;
  year: number;
  month: number;
  section: string;
  group: string;
  name: string;
  amount: Prisma.Decimal;
  note: string | null;
};

export type PendingResponse = Omit<PendingRow, "amount"> & { amount: string };

const SELECT = {
  id: true,
  year: true,
  month: true,
  section: true,
  group: true,
  name: true,
  amount: true,
  note: true,
} as const;

/** Decimal nao sobrevive ao JSON. Dinheiro sai em string, como no resto da API. */
export function toPendingResponse(rows: PendingRow[]): PendingResponse[] {
  return rows.map((r) => ({ ...r, amount: r.amount.toFixed(2) }));
}

export async function addPending(
  userId: string,
  input: {
    year: number;
    month: number;
    section: string;
    group: string;
    name: string;
    amount: string;
    note?: string;
  }
): Promise<{ id: string }> {
  const row = await prisma.pendingExpense.create({
    data: { userId, ...input, amount: new Prisma.Decimal(input.amount) },
    select: { id: true },
  });
  return row;
}

/** Por ordem de chegada: aplicar fora de ordem daria outra formula na celula. */
export async function listPending(userId: string): Promise<PendingResponse[]> {
  const rows = await prisma.pendingExpense.findMany({
    where: { userId },
    select: SELECT,
    orderBy: { createdAt: "asc" },
  });
  return toPendingResponse(rows);
}

/** O userId no where nao e redundante: impede apagar a fila de outra pessoa. */
export async function clearPending(
  userId: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await prisma.pendingExpense.deleteMany({
    where: { userId, id: { in: ids } },
  });
  return count;
}
