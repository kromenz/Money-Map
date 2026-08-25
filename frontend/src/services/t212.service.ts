import api from "../lib/api";
import type {
  CashFlowItem,
  ChartPoint,
  DividendItem,
  OrderItem,
  Overview,
  SyncReport,
} from "../types/t212";

export async function fetchOverview(): Promise<Overview> {
  const { data } = await api.get<Overview>("/t212/overview");
  return data;
}

export async function fetchChart(): Promise<ChartPoint[]> {
  const { data } = await api.get<{ points: ChartPoint[] }>("/t212/chart");
  return data.points;
}

export async function fetchDividends(
  year?: number
): Promise<{ items: DividendItem[]; totalInEuro: string }> {
  const { data } = await api.get<{ items: DividendItem[]; totalInEuro: string }>(
    "/t212/dividends",
    { params: year ? { year } : {} }
  );
  return data;
}

export async function fetchOrders(params: {
  ticker?: string;
  side?: "BUY" | "SELL";
  limit?: number;
  offset?: number;
}): Promise<{ items: OrderItem[]; total: number }> {
  const { data } = await api.get<{ items: OrderItem[]; total: number }>(
    "/t212/orders",
    { params }
  );
  return data;
}

export async function fetchCashFlows(params: {
  limit?: number;
  offset?: number;
}): Promise<{ items: CashFlowItem[]; total: number }> {
  const { data } = await api.get<{ items: CashFlowItem[]; total: number }>(
    "/t212/cashflows",
    { params }
  );
  return data;
}

export async function syncNow(): Promise<SyncReport> {
  const { data } = await api.post<SyncReport>("/t212/sync");
  return data;
}
