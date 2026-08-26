"use client";

import { formatEur, formatPercent } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import type { YearMetrics } from "@/lib/budget-metrics";

/**
 * Os cinco numeros do ano em linha, nao em cartoes empilhados: as duas linhas
 * tracejadas do CashflowChart ja dizem as medias, e cartoes grandes a repetir
 * totais ao lado disso roubavam a largura de que o grafico precisa.
 *
 * Sem o ano escrito: as setas do cabecalho ja dizem qual e o ano que se esta a
 * ver, e repeti-lo aqui era so ruido.
 */
export function YearSummary({ metrics }: { metrics: YearMetrics }) {
  const hidden = useHiddenValues();

  // A taxa de poupanca fica de fora do tapume de proposito: e uma razao entre
  // dois montantes, nao diz nenhum deles, e e o que resta para ler quando os
  // euros estao escondidos.
  const items: { label: string; value: string }[] = [
    { label: "In", value: formatEur(metrics.income, hidden) },
    { label: "Out", value: formatEur(metrics.expenses, hidden) },
    { label: "Saved", value: formatEur(metrics.savings, hidden) },
    { label: "Savings rate", value: formatPercent(metrics.savingsRate) },
    { label: "Left over", value: formatEur(metrics.unallocated, hidden) },
  ];

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-8 gap-y-3">
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
