"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { eurTooltipFormatter } from "./chart-tooltip-eur";
import type { MonthDetail } from "@/lib/budget-metrics";

// Uma entrada por posicao da rampa, nao por grupo: os nomes dos grupos vem do
// ficheiro importado e podem ter espacos, acentos ou "&", e o <ChartStyle> do
// ui/chart.tsx transforma cada chave do config numa custom property
// (--color-<chave>), o que exige um identificador CSS valido. Com chaves fixas
// as cores continuam a viver num sitio so - as fatias e o ponto do tooltip leem
// daqui - e o nome do grupo entra pelo nameKey.
const config = {
  group1: { color: "var(--chart-1)" },
  group2: { color: "var(--chart-2)" },
  group3: { color: "var(--chart-3)" },
  group4: { color: "var(--chart-4)" },
  group5: { color: "var(--chart-5)" },
  group6: { color: "var(--chart-6)" },
} satisfies ChartConfig;

const SLOTS = Object.keys(config);

const formatter = eurTooltipFormatter(config);

export function ExpenseDonut({ byGroup }: { byGroup: MonthDetail["byGroup"] }) {
  // Reembolsos podem deixar um grupo com total liquido negativo (ver
  // budget-metrics.ts). Isso e correto para os totais, mas um <Pie> nao
  // consegue desenhar uma fatia negativa - o angulo da fatia fica invertido
  // e desalinha as fatias seguintes. Filtramos aqui, so para o desenho.
  // O TopCategories, que consome a mesma fonte, mantem os negativos: um
  // <BarChart> desenha-os sem os deformar.
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
        {/* hideLabel: o cabecalho e a linha do tooltip resolviam ambos para o
            nome do grupo (o config nao tem entrada por grupo), imprimindo-o
            duas vezes. */}
        <ChartTooltip
          content={
            <ChartTooltipContent nameKey="group" hideLabel formatter={formatter} />
          }
        />
        <Pie
          data={positive}
          dataKey="amount"
          nameKey="group"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={1}>
          {positive.map((g, i) => (
            <Cell key={g.group} fill={`var(--color-${SLOTS[i % SLOTS.length]})`} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
