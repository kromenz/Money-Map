import { yearFromFileName } from "./year-from-filename";

export type ImportDecision =
  | { action: "reject"; reason: string }
  | { action: "import"; year: number }
  | { action: "preview"; year: number };

/**
 * O que fazer quando largam um ficheiro, e para que ano.
 *
 * O ano sai do nome do ficheiro; sem ano no nome, fica o que esta a ser visto.
 *
 * Um ano vazio importa num gesto so, que e o objectivo. Um ano com dados passa
 * pelo preview porque o import apaga e reescreve o ano inteiro -- largar a
 * folha errada substituia o ano sem falhar, ja que os totais de referencia vem
 * da mesma folha que foi largada.
 */
export function decideImport(params: {
  fileName: string;
  viewedYear: number;
  /** undefined enquanto a lista de anos nao chegou do servidor. */
  yearsWithData: number[] | undefined;
  busy: boolean;
}): ImportDecision {
  if (params.busy) {
    return { action: "reject", reason: "Already importing" };
  }

  if (!params.fileName.toLowerCase().endsWith(".xlsx")) {
    return { action: "reject", reason: "Only .xlsx files are accepted" };
  }

  const year = yearFromFileName(params.fileName) ?? params.viewedYear;

  // Sem a lista, assumir que o ano TEM dados. Assumir o contrario abria uma
  // janela em que largar um ficheiro substituia um ano cheio sem confirmacao.
  // Na duvida, mostra-se o diff.
  const hasData =
    params.yearsWithData === undefined || params.yearsWithData.includes(year);

  return hasData ? { action: "preview", year } : { action: "import", year };
}
