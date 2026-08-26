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
  // Vai parar a uma formula do Excel, que tem um limite de 8192 caracteres --
  // uma etiqueta enorme comia o espaco das compras seguintes na mesma celula.
  note: z.string().trim().max(60).optional(),
});

export const clearBodySchema = z.object({
  ids: z.array(z.string()),
});

/** Ano e mes de uma vista de parcelas. */
export const parcelsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
