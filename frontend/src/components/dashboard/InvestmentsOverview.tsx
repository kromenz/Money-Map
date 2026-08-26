"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { fetchChart, fetchOverview } from "@/services/t212.service";
import { chartData } from "@/lib/t212-metrics";
import { formatEur, formatPercent } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";

const config = {
  marketValue: { label: "Market value", color: "var(--chart-income)" },
} satisfies ChartConfig;

/**
 * O resumo da corretora na pagina do orcamento. O detalhe continua em
 * /investments -- isto e so o suficiente para nao ter de la ir para saber como
 * esta.
 *
 * Reutiliza as chaves "t212-overview" e "t212-chart": e a mesma cache que a
 * pagina de detalhe usa, portanto abrir uma depois da outra nao repete pedidos
 * nem pode mostrar dois totais diferentes.
 *
 * Nao ha estado de erro nem de carregamento. A corretora e um extra desta
 * pagina: uma falha do /t212/overview nao pode encher o orcamento de avisos
 * sobre um assunto que nao e o dele. Quando nao ha resposta, nao ha cartao --
 * a ligacao "Investments" do cabecalho continua la para quem quiser ir ver.
 */
export function InvestmentsOverview() {
  const hidden = useHiddenValues();
  const overview = useQuery({ queryKey: ["t212-overview"], queryFn: fetchOverview });

  const configured = Boolean(overview.data?.configured);
  const chart = useQuery({
    queryKey: ["t212-chart"],
    queryFn: fetchChart,
    enabled: configured,
  });

  // Um ponto so nao desenha nada visivel -- uma linha precisa de dois. Ate la
  // o cartao mostra os numeros sem grafico em vez de uma faixa vazia.
  const spark = useMemo(() => {
    const points = chartData(chart.data ?? []);
    const measured = points.filter((p) => p.marketValue !== null);
    return measured.length >= 2 ? points : [];
  }, [chart.data]);

  const snapshot = overview.data?.snapshot;
  if (!configured || !snapshot) return null;

  const total = Number(snapshot.totalValue);
  const cash = Number(snapshot.cash);
  const invested = Number(snapshot.invested);
  const unrealized = Number(snapshot.unrealizedPl);
  // Sobre o custo das posicoes que ainda estao abertas, que e o que o
  // unrealizedPl mede. Dividir pelo totalValue metia a caixa no denominador e
  // diluia o retorno de quem tem dinheiro parado.
  const ret = invested === 0 ? null : unrealized / invested;
  const up = unrealized >= 0;

  return (
    <Link
      href="/investments"
      className="group block rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          Investments
        </h3>
        <span className="text-xs text-muted-foreground group-hover:text-foreground">
          View details →
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Total
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatEur(total, hidden)}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Unrealized P/L
          </span>
          <span
            className={
              up
                ? "text-xl font-semibold tabular-nums text-chart-income"
                : "text-xl font-semibold tabular-nums text-chart-expenses"
            }>
            {up ? "+" : ""}
            {formatEur(unrealized, hidden)}
            {ret === null ? "" : ` (${up ? "+" : ""}${formatPercent(ret)})`}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Cash
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatEur(cash, hidden)}
          </span>
        </div>
      </div>

      {spark.length > 0 && (
        <ChartContainer config={config} className="mt-3 h-24 w-full">
          <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="spark-market" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-marketValue)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-marketValue)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* connectNulls a false pelo mesmo motivo do grafico grande: um dia
                sem snapshot e um dia em que a app nao correu, e ligar os pontos
                por cima desenhava uma medicao que nunca existiu. */}
            <Area
              type="monotone"
              dataKey="marketValue"
              stroke="var(--color-marketValue)"
              strokeWidth={2}
              fill="url(#spark-market)"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </Link>
  );
}
