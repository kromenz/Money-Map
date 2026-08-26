export const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

// Locale fixo (nao o do browser) para o servidor e o cliente formatarem igual.
const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

// Quatro pontos fixos, nao um por digito: o comprimento da mascara nao pode
// contar quantos algarismos o numero tinha, senao esconder deixava de esconder.
export const HIDDEN = "••••";

export function formatEur(value: number, hidden = false): string {
  if (hidden) return HIDDEN;
  return eur.format(value);
}

// Sem simbolo de moeda, mas com o mesmo locale do formatEur para os milhares e
// as decimais nao divergirem. Na grelha o simbolo repetir-se-ia catorze vezes
// por linha e so rouba largura -- a unidade e anunciada uma vez no cabecalho.
const amount = new Intl.NumberFormat("en-IE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number, hidden = false): string {
  if (hidden) return HIDDEN;
  return amount.format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
