// Uma unica fonte para os nomes das etapas de sync. Duplicar este mapa (por
// exemplo, um em SyncStatus e outro na mensagem de erro da pagina) deixa a
// mesma etapa a aparecer com dois nomes diferentes na mesma pagina.
export const T212_STAGE_LABELS: Record<string, string> = {
  positions: "Portfolio",
  summary: "Account",
  orders: "Orders",
  dividends: "Dividends",
  transactions: "Cash",
  bridge: "Budget",
};

// O identificador cru e melhor do que nada quando uma etapa nova ainda nao
// tem nome no mapa.
export function t212StageLabel(kind: string): string {
  return T212_STAGE_LABELS[kind] ?? kind;
}
