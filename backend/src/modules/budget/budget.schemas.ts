import { z } from "zod";

export const importQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const gridQuerySchema = importQuerySchema;

export const pendingBodySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  section: z.enum(["income", "savings", "expenses"]),
  // Vazio e valido: ha categorias fora de qualquer grupo.
  group: z.string(),
  name: z.string().min(1),
  // Dinheiro viaja em string para nao passar por um float pelo caminho.
  amount: z
    .string()
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, {
      message: "amount tem de ser um numero positivo",
    }),
});

export const clearBodySchema = z.object({
  ids: z.array(z.string()),
});
