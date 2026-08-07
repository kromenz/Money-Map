"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthDetail } from "@/lib/budget-metrics";

const RAMP = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const config = { amount: { label: "Amount" } } satisfies ChartConfig;

export function ExpenseDonut({ byGroup }: { byGroup: MonthDetail["byGroup"] }) {
  // Reembolsos podem deixar um grupo com total liquido negativo (ver
  // budget-metrics.ts). Isso e correto para os totais, mas um <Pie> nao
  // consegue desenhar uma fatia negativa - o angulo da fatia fica invertido
  // e desalinha as fatias seguintes. Filtramos aqui, so para o desenho.
  const positive = byGroup.filter((g) => g.amount > 0);

  if (positive.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No expenses this month
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="group" />} />
        <Pie
          data={positive}
          dataKey="amount"
          nameKey="group"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={1}>
          {positive.map((g, i) => (
            <Cell key={g.group} fill={RAMP[i % RAMP.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
