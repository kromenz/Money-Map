"use client";

import { useMemo, useState } from "react";
import { formatAmount, formatEur, formatPercent } from "@/lib/format";
import { withWeights, type WeightedHolding } from "@/lib/t212-metrics";
import type { Holding } from "@/types/t212";

type Column = {
  key: string;
  label: string;
  numeric: boolean;
  value: (h: WeightedHolding) => number | string;
  render: (h: WeightedHolding) => string;
};

const COLUMNS: Column[] = [
  { key: "ticker", label: "Titulo", numeric: false, value: (h) => h.name || h.ticker, render: (h) => h.name || h.ticker },
  { key: "quantity", label: "Qtd", numeric: true, value: (h) => Number(h.quantity), render: (h) => Number(h.quantity).toFixed(4) },
  { key: "averagePricePaid", label: "Preco medio", numeric: true, value: (h) => Number(h.averagePricePaid), render: (h) => formatAmount(Number(h.averagePricePaid)) },
  { key: "currentPrice", label: "Preco atual", numeric: true, value: (h) => Number(h.currentPrice), render: (h) => formatAmount(Number(h.currentPrice)) },
  { key: "currentValue", label: "Valor", numeric: true, value: (h) => Number(h.currentValue), render: (h) => formatEur(Number(h.currentValue)) },
  { key: "unrealizedPl", label: "P/L", numeric: true, value: (h) => Number(h.unrealizedPl), render: (h) => formatEur(Number(h.unrealizedPl)) },
  { key: "weight", label: "Peso", numeric: true, value: (h) => h.weight ?? 0, render: (h) => formatPercent(h.weight) },
  { key: "fxImpact", label: "Cambio", numeric: true, value: (h) => Number(h.fxImpact), render: (h) => formatEur(Number(h.fxImpact)) },
];

/**
 * Tabela normal com ordenacao num useMemo, e nao uma biblioteca: sao oito
 * colunas e uma carteira de dezenas de linhas. O @tanstack/react-table que a
 * stack previa nunca chegou a ser instalado, e nao se justifica por isto.
 */
export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({
    key: "currentValue",
    desc: true,
  });

  const rows = useMemo(() => {
    const weighted = withWeights(holdings);
    const column = COLUMNS.find((c) => c.key === sort.key) ?? COLUMNS[4];

    return [...weighted].sort((a, b) => {
      const va = column.value(a);
      const vb = column.value(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sort.desc ? -cmp : cmp;
    });
  }, [holdings, sort]);

  if (holdings.length === 0) {
    return <p className="text-sm text-muted-foreground">A carteira esta vazia.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={c.numeric ? "px-2 py-2 text-right" : "px-2 py-2 text-left"}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSort((s) =>
                      s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: true }
                    )
                  }
                  className="hover:text-foreground"
                >
                  {c.label}
                  {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.ticker} className="border-b last:border-0">
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className={
                    c.numeric
                      ? "px-2 py-2 text-right tabular-nums"
                      : "px-2 py-2 text-left"
                  }
                >
                  {c.render(h)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
