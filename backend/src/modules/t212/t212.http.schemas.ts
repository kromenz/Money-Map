import { z } from "zod";

export const dividendsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const ordersQuerySchema = z.object({
  ticker: z.string().optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * O que o frontend devolve depois de escrever na folha.
 *
 * O `amount` e o total da linha, na convencao de armazenamento -- vem do
 * proprio /t212/sheet/pending e volta tal e qual. Aceita negativo: um deposito
 * grava-se com o sinal trocado.
 */
export const sheetWrittenSchema = z.object({
  written: z
    .array(
      z.object({
        externalId: z.string().min(1),
        // String e nao number: dinheiro nao passa por float em lado nenhum
        // desta app, e o Decimal do Prisma le a string directamente.
        amount: z.string().regex(/^-?\d+\.\d{2}$/),
      })
    )
    .max(5000),
});
