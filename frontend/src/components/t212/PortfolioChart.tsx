"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { chartData } from "@/lib/t212-metrics";
import type { ChartPoint } from "@/types/t212";

// As cores vivem so aqui: o <ChartStyle> do ui/chart.tsx transforma cada
// entrada com "color" numa custom property --color-<chave>.
//
// "(reconstruido)" nao e enfeite: o cartao "Investido" no topo da pagina e esta
// linha sao dois numeros diferentes, calculados de maneiras diferentes, e
// podem divergir sem que nenhum esteja errado. O cartao mostra o custo total
// que o proprio broker reporta; esta linha e reconstruida a partir do
// historico de ordens, que ignora taxas e nao ve titulos que entraram por
// transferencia de outra corretora (nunca tiveram uma compra). Sem a distincao
// no rotulo, a diferenca parecia um defeito.
const config = {
  invested: { label: "Invested (reconstructed)", color: "var(--chart-savings)" },
  marketValue: { label: "Market value", color: "var(--chart-income)" },
} satisfies ChartConfig;

/**
 * connectNulls fica a false de proposito. Um dia sem snapshot e um dia em que a
 * app nao correu -- ligar os pontos por cima desenharia uma medicao que nunca
 * existiu, que e o defeito que a folha de Excel tem na linha Monthly remaining.
 *
 * O investido, esse, arrasta-se: e uma funcao em degrau que so muda quando ha
 * execucao, e o servidor ja o entrega arrastado.
 */
export function PortfolioChart({ points }: { points: ChartPoint[] }) {
  const data = useMemo(() => chartData(points), [points]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There is no history to draw yet. The first sync brings in every order;
        the market value only starts being measured from today.
      </p>
    );
  }

  return (
    <ChartContainer config={config} className="h-[280px] w-full">
      <LineChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
          tickFormatter={(v: string) => v.slice(2, 7)}
        />
        <YAxis tickLine={false} axisLine={false} width={64} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="stepAfter"
          dataKey="invested"
          stroke="var(--color-invested)"
          dot={false}
          strokeWidth={2}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="marketValue"
          stroke="var(--color-marketValue)"
          dot={false}
          strokeWidth={2}
          connectNulls={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
