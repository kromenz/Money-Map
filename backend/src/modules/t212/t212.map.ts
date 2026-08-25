import type {
  CashTransaction,
  Dividend,
  HistoricalOrder,
  Position,
} from "./t212.schemas";
// Import de valor e nao `import type`: o `typeof` abaixo precisa do nome no
// espaco dos valores.
import { CASH_FLOW_TYPES } from "./t212.schemas";

export type CashFlowKind = (typeof CASH_FLOW_TYPES)[number];

export type HoldingRow = {
  ticker: string;
  name: string;
  currency: string;
  quantity: string;
  averagePricePaid: string;
  currentPrice: string;
  currentValue: string;
  totalCost: string;
  unrealizedPl: string;
  fxImpact: string;
};

export type OrderRow = {
  externalId: string;
  filledAt: string;
  ticker: string;
  side: "BUY" | "SELL";
  orderType: string;
  quantity: string;
  price: string;
  netValue: string;
  fxRate: string | null;
  taxes: unknown[] | null;
  initiatedFrom: string;
  status: string;
};

export type DividendRow = {
  externalId: string;
  paidOn: string;
  ticker: string;
  quantity: string;
  grossAmountPerShare: string;
  amount: string;
  currency: string;
  amountInEuro: string;
  type: string;
};

export type CashFlowRow = {
  externalId: string;
  dateTime: string;
  type: CashFlowKind;
  amount: string;
  currency: string;
};

/**
 * A API manda numeros JSON. A conversao para string acontece aqui, uma vez, na
 * fronteira -- dai para dentro e sempre Decimal, e nunca ha um float a somar-se
 * a outro. Adiciona offset para corrigir erros de floating-point no arredondamento.
 */
export function money(n: number): string {
  return (Math.round(n * 100 + 1e-6) / 100).toFixed(2);
}

export function qty(n: number): string {
  return n.toFixed(8);
}

export function toHoldingRows(positions: Position[]): HoldingRow[] {
  return positions.map((p) => {
    const impact = p.walletImpact;
    const currentValue = impact?.currentValue ?? p.quantity * p.currentPrice;
    const totalCost = impact?.totalCost ?? p.quantity * p.averagePricePaid;

    return {
      ticker: p.instrument.ticker,
      name: p.instrument.name,
      currency: p.instrument.currency,
      quantity: qty(p.quantity),
      averagePricePaid: qty(p.averagePricePaid),
      currentPrice: qty(p.currentPrice),
      currentValue: money(currentValue),
      totalCost: money(totalCost),
      unrealizedPl: money(
        impact?.unrealizedProfitLoss ?? currentValue - totalCost
      ),
      fxImpact: money(impact?.fxImpact ?? 0),
    };
  });
}

export function toOrderRows(items: HistoricalOrder[]): OrderRow[] {
  const rows: OrderRow[] = [];

  for (const item of items) {
    // Uma ordem cancelada aparece no historico sem execucao. Nao movimentou
    // dinheiro, portanto nao tem linha.
    const fill = item.fill;
    if (!fill) continue;

    const gross = fill.price * fill.quantity;
    const signed = item.order.side === "BUY" ? -gross : gross;

    rows.push({
      externalId: `${item.order.id}:${fill.id}`,
      filledAt: fill.filledAt,
      ticker: item.order.ticker || item.order.instrument?.ticker || "",
      side: item.order.side,
      orderType: item.order.type,
      quantity: qty(fill.quantity),
      price: qty(fill.price),
      netValue: money(fill.walletImpact?.netValue ?? signed),
      fxRate:
        fill.walletImpact?.fxRate === undefined
          ? null
          : qty(fill.walletImpact.fxRate),
      taxes: (fill.walletImpact?.taxes as unknown[] | undefined) ?? null,
      initiatedFrom: item.order.initiatedFrom,
      status: item.order.status,
    });
  }

  return rows;
}

export function toDividendRows(items: Dividend[]): DividendRow[] {
  return items.map((d) => ({
    externalId: d.reference,
    paidOn: d.paidOn,
    ticker: d.ticker,
    quantity: qty(d.quantity),
    grossAmountPerShare: qty(d.grossAmountPerShare),
    amount: money(d.amount),
    currency: d.currency,
    // A API documenta o amountInEuro. Se faltar, fica o amount: para uma conta
    // em EUR sao o mesmo numero, e para um titulo estrangeiro a moeda continua
    // na linha para a interface o mostrar.
    amountInEuro: money(d.amountInEuro ?? d.amount),
    type: d.type,
  }));
}

export function toCashFlowRows(items: CashTransaction[]): CashFlowRow[] {
  return items.map((t) => ({
    externalId: t.reference,
    dateTime: t.dateTime,
    type: t.type,
    amount: money(t.amount),
    currency: t.currency,
  }));
}
