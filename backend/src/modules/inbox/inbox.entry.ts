import { z } from "zod";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Uma data de calendario que existe, dentro da gama que a folha aceita. */
function isCalendarDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const back = new Date(Date.UTC(y, mo - 1, d));
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

/**
 * O que o telemovel escreve, depois de decifrado.
 *
 * Mais apertado do que o pendingBodySchema em dois sitios: o valor tem no
 * maximo 2 casas (o outro so pede um numero positivo, e "2.505" chegava a
 * folha) e a data tem de existir. Uma entrada que passe daqui mas rebente no
 * flush ficava presa na fila; e melhor recusa-la ja, enquanto ainda esta na
 * cloud.
 */
export const inboxEntrySchema = z.object({
  id: z.uuid(),
  date: z.string().refine(isCalendarDate, { message: "data invalida" }),
  section: z.enum(["income", "savings", "expenses"]),
  group: z.string(),
  name: z.string().min(1),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, { message: "valor com formato invalido" })
    .refine((v) => Number(v) > 0, { message: "valor tem de ser positivo" }),
  note: z.string().trim().max(60).optional(),
  createdAt: z.string(),
});

export type InboxEntry = z.infer<typeof inboxEntrySchema>;

/** A forma que o addPending de budget.pending.ts ja aceita. */
export type PendingInput = {
  year: number;
  month: number;
  section: "income" | "savings" | "expenses";
  group: string;
  name: string;
  amount: string;
  note?: string;
};

export function toPendingInput(entry: InboxEntry): PendingInput {
  const [, y, mo] = ISO_DATE.exec(entry.date)!;
  const note = entry.note && entry.note !== "" ? entry.note : undefined;
  return {
    year: Number(y),
    month: Number(mo),
    section: entry.section,
    group: entry.group,
    name: entry.name,
    amount: entry.amount,
    note,
  };
}
