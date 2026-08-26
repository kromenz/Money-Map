export type Snapshot = {
  date: string;
  cash: string;
  invested: string;
  marketValue: string;
  totalValue: string;
  realizedPl: string;
  unrealizedPl: string;
};

export type Holding = {
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

export type SyncStatus = {
  kind: string;
  lastRunAt: string | null;
  lastError: string | null;
  /** Quantos itens a ultima corrida desta etapa saltou no Zod -- uma etapa que salta itens nao pode parecer igual a uma que correu limpa. */
  lastSkipped: number;
};

export type Overview = {
  configured: boolean;
  snapshot: Snapshot | null;
  holdings: Holding[];
  status: SyncStatus[];
  cutoff: string | null;
};

export type ChartPoint = {
  date: string;
  invested: string | null;
  marketValue: string | null;
};

export type DividendItem = {
  externalId: string;
  paidOn: string;
  ticker: string;
  quantity: string;
  amount: string;
  currency: string;
  amountInEuro: string;
  type: string;
};

export type OrderItem = {
  externalId: string;
  filledAt: string;
  ticker: string;
  side: "BUY" | "SELL";
  orderType: string;
  quantity: string;
  price: string;
  netValue: string;
  fxRate: string | null;
  initiatedFrom: string;
};

export type CashFlowItem = {
  externalId: string;
  dateTime: string;
  type: string;
  amount: string;
  currency: string;
  crossesBudget: boolean;
};

export type StageReport = {
  kind: string;
  ok: boolean;
  written: number;
  skipped: number;
  pages: number;
  deleted?: number;
  error?: string;
};

export type SyncReport = {
  startedAt: string;
  finishedAt: string;
  stages: StageReport[];
};
