"use client";

import { useMemo } from "react";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { eurTooltipFormatter } from "@/components/chart-tooltip-eur";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import type { YearTotals } from "@/lib/year-comparison";

// As mesmas tres cores de fluxo do CashflowChart, para as duas vistas nao
// darem significados diferentes a mesma cor. O <ChartStyle> do ui/chart.tsx
// transforma cada chave numa custom property --color-<chave>.
const config = {
  income: { label: "Income", color: "var(--chart-income)" },
  expenses: { label: "Expenses", color: "var(--chart-expenses)" },
  savings: { label: "Savings", color: "var(--chart-savings)" },
} satisfies ChartConfig;

/**
 * Barras agrupadas: uma tripla por ano, todas acima do zero.
 *
 * Nao sao empilhadas de proposito. Empilhar responderia "quanto ao todo", e a
 * pergunta aqui e "receita deste ano contra receita do ano passado" -- que so
 * se compara com as barras a assentar todas na mesma linha de base.
 */
export function YearTotalsChart({ totals }: { totals: YearTotals[] }) {
  const hidden = useHiddenValues();
  const formatter = useMemo(
    () => eurTooltipFormatter(config, undefined, hidden),
    [hidden]
  );
  const data = totals.map((t) => ({
    label: String(t.year),
    income: t.income,
    expenses: t.expenses,
    savings: t.savings,
  }));

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />

        {/* Um ano de poupanca liquida negativa desenha para baixo, e sem esta
            linha a barra ficava pendurada a partir do nada. */}
        <ReferenceLine y={0} stroke="var(--border)" />

        <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="savings" fill="var(--color-savings)" radius={[3, 3, 0, 0]} />

        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
