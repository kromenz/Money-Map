"use client";

import { formatEur } from "@/lib/format";
import type { ChartConfig } from "@/components/ui/chart";

/**
 * O <ChartTooltipContent> do shadcn imprime o valor com toLocaleString() sem
 * argumento de locale, por isso o tooltip mostrava "1,234.56" (ou "1234,56"
 * num browser pt-PT) ao lado de KPIs formatados com formatEur em en-IE.
 *
 * A unica saida e passar um "formatter" - mas esse formatter substitui a linha
 * inteira, nao apenas o numero (ver ui/chart.tsx: o ramo do formatter troca o
 * indicador, o nome e o valor de uma so vez). Por isso reconstruimos aqui as
 * tres pecas com as mesmas classes do original.
 *
 * Os parametros ficam "unknown" de proposito: o tipo da prop e a interseccao de
 * dois formatters do recharts e so uma assinatura suficientemente lata encaixa
 * nos dois.
 */
export function eurTooltipFormatter(config: ChartConfig) {
  return (value: unknown, name: unknown, item: unknown) => {
    const key = String(name);
    const entry = item as
      | { color?: string; payload?: { fill?: string } }
      | undefined;
    // Mesma ordem de precedencia do ui/chart.tsx: a cor da fatia/barra (posta
    // por um <Cell>) ganha a cor da serie.
    const color = entry?.payload?.fill ?? entry?.color;

    return (
      <>
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        <div className="flex flex-1 items-center justify-between gap-2 leading-none">
          <span className="text-muted-foreground">
            {config[key]?.label ?? key}
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatEur(Number(value))}
          </span>
        </div>
      </>
    );
  };
}
