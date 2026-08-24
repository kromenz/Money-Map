"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MONTH_LABELS } from "@/lib/format";
import { eurTooltipFormatter } from "./chart-tooltip-eur";
import type { YearSeries } from "@/lib/year-comparison";

// Uma entrada por posicao da rampa e nao por ano, pela mesma razao que o
// GroupComposition o faz: as chaves viram custom properties (--color-<chave>) e
// tem de ser identificadores validos. Indexadas sem modulo -- a vista corta em
// seis anos e ciclar daria ao setimo a cor do primeiro.
const SLOTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/**
 * Poupanca acumulada, uma linha por ano sobre os doze meses.
 *
 * Compara justo: em Agosto ve-se Agosto contra Agosto. Um ano a meio acaba onde
 * parou, porque os pontos depois do ultimo mes com movimento vem a null -- ver o
 * cumulativeSavings. O connectNulls fica explicitamente a false: e o
 * comportamento por omissao, mas aqui e o ponto todo do grafico e nao um acaso.
 */
export function CumulativeChart({ series }: { series: YearSeries[] }) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [`s${i}`, { label: String(s.year), color: SLOTS[i] }])
  );

  const data = MONTH_LABELS.map((label, month) => {
    const point: Record<string, string | number | null> = { label };
    series.forEach((s, i) => {
      point[`s${i}`] = s.points[month];
    });
    return point;
  });

  const formatter = eurTooltipFormatter(config);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-[10px]" />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />

        {series.map((s, i) => (
          <Line
            key={s.year}
            type="monotone"
            dataKey={`s${i}`}
            stroke={`var(--color-s${i})`}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        ))}

        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
  );
}
