"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthDetail } from "@/lib/budget-metrics";

const config = {
  amount: { label: "Amount", color: "var(--chart-expenses)" },
} satisfies ChartConfig;

export function TopCategories({
  items,
}: {
  items: MonthDetail["topCategories"];
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Nothing to show
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={items} layout="vertical" margin={{ left: 12 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          className="text-xs"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="amount" fill="var(--chart-expenses)" radius={3} />
      </BarChart>
    </ChartContainer>
  );
}
