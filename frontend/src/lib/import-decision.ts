export type ImportDecision =
  | { action: "reject"; reason: string }
  | { action: "import" }
  | { action: "preview" };

/**
 * O que fazer quando largam um ficheiro.
 *
 * Um ano vazio importa num gesto so, que e o objectivo. Um ano com dados passa
 * pelo preview porque o import apaga e reescreve o ano inteiro -- largar a
 * folha errada substituia o ano sem falhar, ja que os totais de referencia vem
 * da mesma folha que foi largada.
 */
export function decideImport(params: {
  fileName: string;
  yearHasData: boolean;
  busy: boolean;
}): ImportDecision {
  if (params.busy) {
    return { action: "reject", reason: "Already importing" };
  }

  if (!params.fileName.toLowerCase().endsWith(".xlsx")) {
    return { action: "reject", reason: "Only .xlsx files are accepted" };
  }

  return params.yearHasData ? { action: "preview" } : { action: "import" };
}
