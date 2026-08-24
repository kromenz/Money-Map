import api from "../lib/api";
import type {
  GridResponse,
  ImportResult,
  PreviewResult,
  YearWithData,
} from "../types/budget";

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
    // 422 significa "nada foi gravado, os totais nao batem" -- a transacao
    // reverteu. E uma resposta com corpo util, nao um erro de rede.
    validateStatus: (s) => s === 200 || s === 422,
  });
  return data;
}

export async function fetchYears(): Promise<YearWithData[]> {
  const { data } = await api.get<{ years: YearWithData[] }>("/budget/years");
  return data.years;
}

export async function previewWorkbook(
  file: File,
  year: number
): Promise<PreviewResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("year", String(year));

  const { data } = await api.post<PreviewResult>("/budget/preview", form);
  return data;
}
