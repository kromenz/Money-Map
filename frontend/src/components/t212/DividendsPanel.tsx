"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fetchDividends } from "@/services/t212.service";
import { dividendsByMonth } from "@/lib/t212-metrics";
import { formatEur, MONTH_LABELS } from "@/lib/format";

const config = {
  total: { label: "Dividends", color: "var(--chart-income)" },
} satisfies ChartConfig;

export function DividendsPanel() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data } = useQuery({
    queryKey: ["t212-dividends", year],
    queryFn: () => fetchDividends(year),
  });

  const months = useMemo(
    () =>
      dividendsByMonth(data?.items ?? [], year).map((m) => ({
        label: MONTH_LABELS[m.month - 1],
        total: m.total,
      })),
    [data, year]
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Dividends</h2>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => setYear((y) => y - 1)} className="text-muted-foreground hover:text-foreground">←</button>
          <span className="tabular-nums">{year}</span>
          <button type="button" onClick={() => setYear((y) => y + 1)} className="text-muted-foreground hover:text-foreground">→</button>
          <span className="ml-4 font-semibold tabular-nums">
            {formatEur(Number(data?.totalInEuro ?? 0))}
          </span>
        </div>
      </div>

      <ChartContainer config={config} className="h-[160px] w-full">
        <BarChart data={months}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={4} />
        </BarChart>
      </ChartContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Instrument</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-right">In euros</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((d) => (
              <tr key={d.externalId} className="border-b last:border-0">
                <td className="px-2 py-2">{d.paidOn}</td>
                <td className="px-2 py-2">{d.ticker}</td>
                <td className="px-2 py-2 text-right tabular-nums">{Number(d.quantity).toFixed(4)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {Number(d.amount).toFixed(2)} {d.currency}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{formatEur(Number(d.amountInEuro))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
