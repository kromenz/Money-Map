import { z } from "zod";

/**
 * A API esta em beta e ja mudou uma vez -- /equity/account/cash e /info
 * desapareceram. Estes contratos sao deliberadamente frouxos onde o campo so
 * enfeita, e estritos onde o campo decide para onde vai dinheiro.
 */

/**
 * A API manda `null` em vez de omitir o campo sempre que nao ha nada a
 * reportar -- fxImpact vem null sempre que a moeda do instrumento e igual a
 * da conta, por exemplo. `.default()` do Zod so dispara em `undefined`;
 * contra `null` o campo falha sozinho e arrasta o objecto inteiro consigo.
 * Foi assim que sete ETFs em euros (~107 EUR) desapareceram de uma
 * sincronizacao real: a API devolveu 72 posicoes, a base ficou com 65, e a
 * etapa reportou ok:true. Este ajudante aceita as duas formas de "nada aqui"
 * (null e undefined) e resolve para o valor por omissao indicado.
 */
function nullableNumber(fallback: number) {
  return z
    .number()
    .nullish()
    .transform((v) => v ?? fallback);
}

/**
 * Variante sem valor por omissao: para campos onde null/ausente tem de
 * continuar a significar "sem dado", nao "zero" -- netValue, que o
 * toOrderRows deriva do preco vezes quantidade quando falta, e amountInEuro,
 * que o toDividendRows faz cair no amount. Colapsa null e undefined no mesmo
 * `undefined`, para o `??` de quem le continuar a disparar. Um
 * nullableNumber(0) aqui desarmaria esse fallback tal como o .default(0)
 * desarmava o de fxImpact.
 */
function nullableOptionalNumber() {
  return z
    .number()
    .nullish()
    .transform((v) => v ?? undefined)
    .optional();
}

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
    inPies: nullableNumber(0),
    reservedForOrders: nullableNumber(0),
  }),
  investments: z.object({
    currentValue: z.number(),
    totalCost: z.number(),
    realizedProfitLoss: nullableNumber(0),
    unrealizedProfitLoss: nullableNumber(0),
  }),
  totalValue: z.number(),
});

export const positionSchema = z.object({
  instrument: instrumentSchema,
  quantity: z.number(),
  averagePricePaid: z.number(),
  currentPrice: nullableNumber(0),
  walletImpact: z
    .object({
      currentValue: nullableNumber(0),
      totalCost: nullableNumber(0),
      unrealizedProfitLoss: nullableNumber(0),
      // O campo que causou o defeito: null sempre que a moeda do instrumento
      // e da conta coincidem.
      fxImpact: nullableNumber(0),
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
          // nullableOptionalNumber() e nao nullableNumber(0): o toOrderRows
          // tem um recurso escrito de proposito -- `walletImpact?.netValue ??
          // signed` -- que cai no preco vezes quantidade quando o valor nao
          // vem. Com um valor por omissao (0, seja de .default() ou de
          // nullableNumber(0)), o Zod preenchia zero, o ?? nao disparava
          // (zero nao e nulo/undefined) e gravava-se "0.00". Desde que a
          // serie do grafico passou a derivar o preco em moeda da conta a
          // partir do netValue, uma execucao assim entrava com custo zero e
          // subavaliava a linha do investido sem sinal nenhum. A API tanto
          // omite este campo como manda null explicito -- as duas formas tem
          // de continuar a cair no derivado, nunca em zero.
          netValue: nullableOptionalNumber(),
          fxRate: nullableOptionalNumber(),
          realisedProfitLoss: nullableNumber(0),
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
  quantity: nullableNumber(0),
  grossAmountPerShare: nullableNumber(0),
  amount: z.number(),
  currency: z.string().default(""),
  // Sem valor por omissao: o toDividendRows cai no amount quando falta, e um
  // amountInEuro:0 apagaria isso silenciosamente.
  amountInEuro: nullableOptionalNumber(),
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
