import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { PendingInput } from "./inbox.entry";

export async function alreadyReceived(sourceId: string): Promise<boolean> {
  return (await prisma.inboxReceipt.count({ where: { sourceId } })) > 0;
}

/**
 * Pendente e recibo na mesma transaccao. Separados, uma queda entre os dois
 * deixava ou um gasto sem recibo (duplicava no pull seguinte) ou um recibo
 * sem gasto (perdia-o).
 *
 * P2002 no recibo quer dizer que outra corrida ja o recebeu. A transaccao
 * reverteu as duas linhas, portanto nao ha nada a desfazer.
 */
export function receiverFor(userId: string) {
  return async (sourceId: string, input: PendingInput): Promise<void> => {
    try {
      await prisma.$transaction([
        prisma.pendingExpense.create({
          data: { userId, ...input, amount: new Prisma.Decimal(input.amount) },
        }),
        prisma.inboxReceipt.create({ data: { userId, sourceId } }),
      ]);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
      throw err;
    }
  };
}
