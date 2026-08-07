"use client";

import { Bar, BarChart, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MONTH_LABELS } from "@/lib/format";
import { eurTooltipFormatter } from "./chart-tooltip-eur";
import type { MonthPoint } from "@/lib/budget-metrics";

// As cores vivem so aqui: o <ChartStyle> do ui/chart.tsx transforma cada
// entrada com "color" numa custom property --color-<chave> no contentor, e as
// series leem-na com var(--color-<chave>). Assim nao ha o mesmo valor escrito
// em dois sitios.
const config = {
  income: { label: "Income", color: "var(--chart-income)" },
  expenses: { label: "Expenses", color: "var(--chart-expenses)" },
} satisfies ChartConfig;

const formatter = eurTooltipFormatter(config);

// Eixo X proprio para a barra invisivel de clique. O recharts divide a largura
// de cada mes pelo numero de barras do mesmo xAxisId (barSelectors.js:20-25
// filtra as barras por xAxisId antes de calcular os tamanhos), por isso uma
// terceira barra no eixo predefinido encolheria as duas visiveis para um terco.
// Num eixo separado a barra de clique fica sozinha e ocupa o mes inteiro.
const HIT_AXIS = "hit";

export function MonthSelectorChart({
  months,
  selectedMonth,
  onSelectMonth,
}: {
  months: MonthPoint[];
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}) {
  // O recharts descarta rectangulos de dimensao zero antes de desenhar
  // (cartesian/Bar.js:663), e o onClick vive no <Cell> desse rectangulo: um mes
  // com receita e despesa a zero nao produzia SVG nenhum e ficava impossivel de
  // seleccionar. Como lastActiveMonth conta tambem as poupancas, um ano com uma
  // unica transferencia em Dezembro abria em Dezembro e depois de clicar noutro
  // mes Dezembro deixava de estar acessivel.
  //
  // A barra "hit" tem sempre a altura do maximo do dominio e fill="transparent"
  // (uma cor com alfa 0 continua a ser "painted" em SVG, logo recebe eventos;
  // fill="none" nao receberia), por isso todos os 12 meses sao clicaveis.
  const hit = Math.max(
    1,
    ...months.map((m) => Math.max(m.income, m.expenses, 0))
  );
  const data = months.map((m) => ({
    ...m,
    label: MONTH_LABELS[m.month],
    hit,
  }));

  // Reutilizado nas tres <Bar>: elementos React sao descricoes imutaveis,
  // seguros de usar como filhos em varios sitios.
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
        {/* Escondido e sem espaco reservado: selectChartOffsetInternal.js:36-45
            ignora os eixos com hide ao calcular as margens. */}
        <XAxis xAxisId={HIT_AXIS} dataKey="label" hide />
        <ChartTooltip content={<ChartTooltipContent formatter={formatter} />} />
        {/* Primeiro no DOM, logo atras das series. tooltipType="none" mantem-na
            fora do tooltip (Bar.js:85 copia-o para o payload, ui/chart.tsx:199
            filtra por ele). */}
        <Bar
          xAxisId={HIT_AXIS}
          dataKey="hit"
          fill="transparent"
          tooltipType="none"
          isAnimationActive={false}
        >
          {cells}
        </Bar>
        <Bar dataKey="income" fill="var(--color-income)" radius={2}>
          {cells}
        </Bar>
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={2}>
          {cells}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
