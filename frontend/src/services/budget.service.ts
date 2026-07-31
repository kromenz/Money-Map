import api from "../lib/api";
import type { GridResponse, ImportResult } from "../types/budget";

export async function fetchGrid(year: number): Promise<GridResponse> {
  const { data } = await api.get<GridResponse>("/budget/grid", {
    params: { year },
  });
  return data;
}

export async function importWorkbook(
  file: File,
  year: number
): Promise<ImportResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("year", String(year));

  const { data } = await api.post<ImportResult>("/budget/import", form, {
    // 422 significa "importado mas os totais nao batem" -- e uma resposta
    // com corpo util, nao um erro de rede.
    validateStatus: (s) => s === 200 || s === 422,
  });
  return data;
}
