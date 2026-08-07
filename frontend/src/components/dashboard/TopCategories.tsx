"use client";

import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { eurTooltipFormatter } from "./chart-tooltip-eur";
import type { MonthDetail } from "@/lib/budget-metrics";

// As cores vivem so aqui e chegam as barras como --color-<chave>, emitidas pelo
// <ChartStyle> do ui/chart.tsx a partir deste config. A entrada "refund" existe
// para guardar a cor das barras negativas; o tooltip continua a identificar as
// linhas por "amount" (o dataKey da serie).
const config = {
  amount: { label: "Amount", color: "var(--chart-expenses)" },
  refund: { label: "Refund", color: "var(--chart-income)" },
} satisfies ChartConfig;

const formatter = eurTooltipFormatter(config);

export function TopCategories({
  topCategories,
}: {
  topCategories: MonthDetail["topCategories"];
}) {
  if (topCategories.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No expenses this month
      </div>
    );
  }

  // Ao contrario do ExpenseDonut (que filtra os grupos negativos porque um
  // <Pie> nao consegue desenhar uma fatia de angulo negativo), aqui mostramos o
  // valor liquido tal como o monthDetail o calcula: uma categoria fica negativa
  // quando os reembolsos do mes superam o gasto, e um <BarChart> desenha isso
  // honestamente. Para o sinal se ler, damos outra cor as barras negativas e
  // mostramos o zero -- sem linha de referencia a barra crescia para a esquerda
  // a partir de um eixo invisivel e pesava tanto como um custo.
  const hasNegative = topCategories.some((c) => c.amount < 0);
  const data = topCategories.map((c) => ({
    ...c,
    fill: c.amount < 0 ? "var(--color-refund)" : "var(--color-amount)",
  }));

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
        <XAxis
          type="number"
          hide={!hasNegative}
          tickLine={false}
          axisLine={false}
          className="text-[10px]"
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          className="text-xs"
        />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        {/* Sem stroke explicito: o ui/chart.tsx tem uma regra para o #ccc
            predefinido do recharts que o troca pelo token "border". */}
        <ReferenceLine x={0} />
        <Bar dataKey="amount" radius={3}>
          {/* Indice como chave: os nomes vem do ficheiro importado e podem
              repetir-se entre grupos. */}
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
