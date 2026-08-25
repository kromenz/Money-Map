// Uma unica fonte para os nomes das etapas de sync em portugues. Duplicar este
// mapa (por exemplo, um em SyncStatus e outro na mensagem de erro da pagina)
// deixa a mesma etapa a aparecer com dois nomes diferentes na mesma pagina.
export const T212_STAGE_LABELS: Record<string, string> = {
  positions: "Carteira",
  summary: "Conta",
  orders: "Ordens",
  dividends: "Dividendos",
  transactions: "Caixa",
};

// O identificador cru e melhor do que nada quando uma etapa nova ainda nao
// tem tradução no mapa.
export function t212StageLabel(kind: string): string {
  return T212_STAGE_LABELS[kind] ?? kind;
}
