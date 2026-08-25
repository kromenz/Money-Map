import { z } from "zod";

/**
 * A API esta em beta e ja mudou uma vez -- /equity/account/cash e /info
 * desapareceram. Estes contratos sao deliberadamente frouxos onde o campo so
 * enfeita, e estritos onde o campo decide para onde vai dinheiro.
 */

export const instrumentSchema = z.object({
  ticker: z.string(),
  isin: z.string().default(""),
  name: z.string().default(""),
  currency: z.string().default(""),
});

export const accountSummarySchema = z.object({
  currency: z.string().default(""),
  cash: z.object({
    availableToTrade: z.number(),
    inPies: z.number().default(0),
    reservedForOrders: z.number().default(0),
  }),
  investments: z.object({
    currentValue: z.number(),
    totalCost: z.number(),
    realizedProfitLoss: z.number().default(0),
    unrealizedProfitLoss: z.number().default(0),
  }),
  totalValue: z.number(),
});

export const positionSchema = z.object({
  instrument: instrumentSchema,
  quantity: z.number(),
  averagePricePaid: z.number(),
  currentPrice: z.number().default(0),
  walletImpact: z
    .object({
      currentValue: z.number().default(0),
      totalCost: z.number().default(0),
      unrealizedProfitLoss: z.number().default(0),
      fxImpact: z.number().default(0),
    })
    .optional(),
});

export const historicalOrderSchema = z.object({
  order: z.object({
    id: z.number(),
    ticker: z.string().default(""),
    side: z.enum(["BUY", "SELL"]),
    type: z.string().default(""),
    status: z.string().default(""),
    initiatedFrom: z.string().default(""),
    instrument: instrumentSchema.optional(),
  }),
  // Opcional de proposito: uma ordem cancelada aparece no historico sem
  // execucao. O map salta-a; nao e um item torto.
  fill: z
    .object({
      id: z.number(),
      filledAt: z.string(),
      price: z.number(),
      quantity: z.number(),
      walletImpact: z
        .object({
          netValue: z.number().default(0),
          fxRate: z.number().optional(),
          realisedProfitLoss: z.number().default(0),
          taxes: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const dividendSchema = z.object({
  reference: z.string(),
  paidOn: z.string(),
  ticker: z.string().default(""),
  quantity: z.number().default(0),
  grossAmountPerShare: z.number().default(0),
  amount: z.number(),
  currency: z.string().default(""),
  amountInEuro: z.number().optional(),
  // String e nao enum: o tipo de dividendo nao decide nada -- todos sao receita.
  type: z.string().default(""),
});

export const CASH_FLOW_TYPES = [
  "DEPOSIT",
  "WITHDRAW",
  "FEE",
  "TRANSFER",
  "INTEREST_ON_FREE_CASH",
  "LENDING_INTEREST",
] as const;

/**
 * Enum estrito, ao contrario do dividendo: e este campo que decide se o
 * movimento atravessa para a grelha como poupanca. Um tipo novo tem de falhar
 * e ser registado, nunca cair num ramo por omissao.
 */
export const cashTransactionSchema = z.object({
  reference: z.string(),
  dateTime: z.string(),
  amount: z.number(),
  currency: z.string().default(""),
  type: z.enum(CASH_FLOW_TYPES),
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;
export type Position = z.infer<typeof positionSchema>;
export type HistoricalOrder = z.infer<typeof historicalOrderSchema>;
export type Dividend = z.infer<typeof dividendSchema>;
export type CashTransaction = z.infer<typeof cashTransactionSchema>;

export type ParseOutcome<T> = {
  items: T[];
  skipped: { index: number; message: string }[];
};

/** Um item torto nao pode custar a sincronizacao dos outros. */
export function parseItems<T>(
  schema: z.ZodType<T>,
  raw: unknown[]
): ParseOutcome<T> {
  const items: T[] = [];
  const skipped: { index: number; message: string }[] = [];

  raw.forEach((entry, index) => {
    const parsed = schema.safeParse(entry);
    if (parsed.success) {
      items.push(parsed.data);
      return;
    }
    skipped.push({
      index,
      message: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  });

  return { items, skipped };
}
