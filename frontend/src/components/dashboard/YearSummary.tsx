"use client";

import { formatEur, formatPercent } from "@/lib/format";
import type { YearMetrics } from "@/lib/budget-metrics";

/**
 * Os cinco numeros do ano em linha, nao em cartoes empilhados: as duas linhas
 * tracejadas do CashflowChart ja dizem as medias, e cartoes grandes a repetir
 * totais ao lado disso roubavam a largura de que o grafico precisa.
 */
export function YearSummary({
  year,
  metrics,
}: {
  year: number;
  metrics: YearMetrics;
}) {
  const items: { label: string; value: string }[] = [
    { label: "In", value: formatEur(metrics.income) },
    { label: "Out", value: formatEur(metrics.expenses) },
    { label: "Saved", value: formatEur(metrics.savings) },
    { label: "Savings rate", value: formatPercent(metrics.savingsRate) },
    { label: "Left over", value: formatEur(metrics.unallocated) },
  ];

  return (
    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
      <span className="text-sm font-medium text-muted-foreground">{year}</span>
      {items.map((i) => (
        <div key={i.label} className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {i.label}
          </span>
          <span className="text-xl font-semibold tabular-nums">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
