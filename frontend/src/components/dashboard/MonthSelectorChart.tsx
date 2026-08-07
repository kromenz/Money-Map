"use client";

import { Bar, BarChart, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MONTH_LABELS } from "@/lib/format";
import type { MonthPoint } from "@/lib/budget-metrics";

const config = {
  income: { label: "Income", color: "var(--chart-income)" },
  expenses: { label: "Expenses", color: "var(--chart-expenses)" },
} satisfies ChartConfig;

export function MonthSelectorChart({
  months,
  selectedMonth,
  onSelectMonth,
}: {
  months: MonthPoint[];
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}) {
  const data = months.map((m) => ({ ...m, label: MONTH_LABELS[m.month] }));

  // Reutilizado nas duas <Bar>: elementos React sao descricoes imutaveis,
  // seguros de usar como filhos em dois sitios.
  const cells = data.map((d) => (
    <Cell
      key={d.month}
      opacity={d.month === selectedMonth ? 1 : 0.45}
      onClick={() => onSelectMonth(d.month)}
      cursor="pointer"
    />
  ));

  return (
    <ChartContainer config={config} className="h-48 w-full">
      <BarChart data={data} barCategoryGap={2}>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={1}
          className="text-[10px]"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="income" fill="var(--chart-income)" radius={2}>
          {cells}
        </Bar>
        <Bar dataKey="expenses" fill="var(--chart-expenses)" radius={2}>
          {cells}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
