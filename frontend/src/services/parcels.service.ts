import api from "../lib/api";
import type { MonthParcels } from "../types/parcels";

export async function fetchMonthParcels(
  year: number,
  month: number
): Promise<MonthParcels> {
  const { data } = await api.get<MonthParcels>("/budget/parcels", {
    params: { year, month },
  });
  return data;
}
