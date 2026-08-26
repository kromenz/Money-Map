"use client";

import { formatEur } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import type { Snapshot } from "@/types/t212";

/**
 * A mesma forma do YearSummary do dashboard: numeros em linha, sem cartoes. A
 * pagina e para ser lida de uma vez, e cartoes empilhados empurravam o grafico
 * para baixo da dobra.
 */
export function PortfolioSummary({ snapshot }: { snapshot: Snapshot | null }) {
  const hidden = useHiddenValues();

  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">
        There is no portfolio snapshot yet. Sync to create the first one.
      </p>
    );
  }

  const items = [
    { label: "Total", value: formatEur(Number(snapshot.totalValue), hidden) },
    { label: "Invested", value: formatEur(Number(snapshot.invested), hidden) },
    { label: "Market value", value: formatEur(Number(snapshot.marketValue), hidden) },
    { label: "Cash", value: formatEur(Number(snapshot.cash), hidden) },
    { label: "Unrealized P/L", value: formatEur(Number(snapshot.unrealizedPl), hidden) },
    { label: "Realized P/L", value: formatEur(Number(snapshot.realizedPl), hidden) },
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
