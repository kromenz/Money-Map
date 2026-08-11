"use client";

import { Bar, BarChart, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MONTH_LABELS } from "@/lib/format";
import { eurTooltipFormatter } from "./chart-tooltip-eur";
import type { MonthPoint, MonthAverages } from "@/lib/budget-metrics";

// As cores vivem so aqui: o <ChartStyle> do ui/chart.tsx transforma cada entrada
// com "color" numa custom property --color-<chave> no contentor, e as series
// leem-na com var(--color-<chave>).
const config = {
  income: { label: "Income", color: "var(--chart-income)" },
  expensesDown: { label: "Expenses", color: "var(--chart-expenses)" },
  savingsDown: { label: "Savings", color: "var(--chart-savings)" },
} satisfies ChartConfig;

// Eixo X proprio para as barras invisiveis de clique. O recharts divide a
// largura de cada mes pelo numero de barras do mesmo xAxisId
// (barSelectors.js:20-25), por isso barras de clique no eixo predefinido
// encolheriam as visiveis. Num eixo separado ficam sozinhas e ocupam o mes.
const HIT_AXIS = "hit";

// Despesa e poupanca chegam ao grafico negativas, para cairem abaixo do zero.
// O sinal e uma conveniencia de desenho, nao um facto sobre o dinheiro: o
// tooltip mostra os tres valores em positivo.
const formatter = eurTooltipFormatter(config, Math.abs);

/**
 * No tema escuro o par receita/despesa fica em CVD ΔE 7.8, dentro da banda 6-8
 * que so e legal com codificacao secundaria. O reforco sao os rotulos directos
 * do mes seleccionado, a folga entre segmentos empilhados e a legenda. Se
 * alguem tirar qualquer um deles, a paleta deixa de estar conforme sem que nada
 * falhe visivelmente.
 */
export function CashflowChart({
  months,
  averages,
  selectedMonth,
  onSelectMonth,
}: {
  months: MonthPoint[];
  averages: MonthAverages;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}) {
  // Despesa e poupanca vao para baixo do zero: as duas sao dinheiro que sai, e
  // empilha-las torna o total de saida comparavel de relance com a receita
  // acima. A folga entre os dois lados e o que sobrou nesse mes.
  const data = months.map((m) => ({
    month: m.month,
    label: MONTH_LABELS[m.month],
    income: m.income,
    expensesDown: -m.expenses,
    savingsDown: -m.savings,
    hitUp: 0,
    hitDown: 0,
  }));

  // Barras de clique com a altura maxima do dominio, para os 12 meses serem
  // clicaveis mesmo a zeros: o recharts descarta rectangulos de dimensao zero
  // antes de desenhar (cartesian/Bar.js:663) e o onClick vive no <Cell> desse
  // rectangulo. Sao duas -- uma para cima e outra para baixo -- porque o
  // grafico tem os dois lados. fill="transparent" e nao "none": uma cor com
  // alfa 0 continua a ser painted em SVG, logo recebe eventos.
  const reach = Math.max(
    1,
    ...months.map((m) => Math.max(m.income, m.expenses + m.savings))
  );
  for (const d of data) {
    d.hitUp = reach;
    d.hitDown = -reach;
  }

  const cells = data.map((d) => (
    <Cell
      key={d.month}
      opacity={d.month === selectedMonth ? 1 : 0.45}
      onClick={() => onSelectMonth(d.month)}
      cursor="pointer"
    />
  ));

  const outflow = averages.expenses + averages.savings;

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} barCategoryGap={2} stackOffset="sign">
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          className="text-[10px]"
        />
        {/* Escondido e sem espaco reservado: selectChartOffsetInternal.js:36-45
            ignora os eixos com hide ao calcular as margens. */}
        <XAxis xAxisId={HIT_AXIS} dataKey="label" hide />
        {/* Explicito, mesmo escondido: as <ReferenceLine y=...> precisam de um
            eixo Y declarado para se posicionarem. Sem ele ficavam no sitio
            errado ou nao apareciam de todo. */}
        <YAxis hide domain={[-reach, reach]} />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />

        {/* Primeiro no DOM, logo atras das series. tooltipType="none" mantem-nas
            fora do tooltip (Bar.js:85 copia-o para o payload, ui/chart.tsx:199
            filtra por ele). */}
        <Bar xAxisId={HIT_AXIS} dataKey="hitUp" stackId="hit" fill="transparent" tooltipType="none" isAnimationActive={false}>
          {cells}
        </Bar>
        <Bar xAxisId={HIT_AXIS} dataKey="hitDown" stackId="hit" fill="transparent" tooltipType="none" isAnimationActive={false}>
          {cells}
        </Bar>

        {averages.activeMonths > 0 && (
          <ReferenceLine
            y={averages.income}
            strokeDasharray="5 4"
            stroke="var(--muted-foreground)"
          />
        )}
        {averages.activeMonths > 0 && (
          <ReferenceLine
            y={-outflow}
            strokeDasharray="5 4"
            stroke="var(--muted-foreground)"
          />
        )}
        <ReferenceLine y={0} stroke="var(--border)" />

        <Bar dataKey="income" stackId="flow" fill="var(--color-income)" radius={[3, 3, 0, 0]}>
          {cells}
        </Bar>
        <Bar dataKey="expensesDown" stackId="flow" fill="var(--color-expensesDown)">
          {cells}
        </Bar>
        <Bar dataKey="savingsDown" stackId="flow" fill="var(--color-savingsDown)" radius={[0, 0, 3, 3]}>
          {cells}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
