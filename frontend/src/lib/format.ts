export const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

// Locale fixo (nao o do browser) para o servidor e o cliente formatarem igual.
const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

export function formatEur(value: number): string {
  return eur.format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
