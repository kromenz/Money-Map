"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { Skeleton } from "../../src/components/ui/skeleton";
import { YearTotalsChart } from "../../src/components/dashboard/YearTotalsChart";
import { CumulativeChart } from "../../src/components/dashboard/CumulativeChart";
import { fetchGrid, fetchYears } from "../../src/services/budget.service";
import { cumulativeSavings, yearTotals } from "../../src/lib/year-comparison";
import type { GridResponse } from "../../src/types/budget";

// A rampa --chart-1..6 tem seis cores e o metodo que a validou proibe cicla-las:
// com sete anos o setimo ficava com a cor do primeiro.
const MAX_YEARS = 6;

export default function YearsPage() {
  const { user, loading } = useRequireAuth("/");

  const {
    data: years,
    isPending: yearsPending,
    isError: yearsError,
  } = useQuery({
    queryKey: ["budget-years"],
    queryFn: fetchYears,
    enabled: Boolean(user),
  });

  // Escolhem-se os mais RECENTES, desenham-se por ordem CRESCENTE: quem tem
  // muitos anos quer ver os ultimos, mas um eixo que va do maior para o menor
  // le-se ao contrario.
  const shown = useMemo(() => {
    if (!years) return [];
    return years
      .map((y) => y.year)
      .sort((a, b) => b - a)
      .slice(0, MAX_YEARS)
      .sort((a, b) => a - b);
  }, [years]);

  // A mesma queryKey do dashboard: o ano que ja la esteve nao volta a rede.
  const grids = useQueries({
    queries: shown.map((year) => ({
      queryKey: ["budget-grid", year],
      queryFn: () => fetchGrid(year),
    })),
  });

  // O every de um array vazio e true. Sem o shown.length > 0, uma falha na
  // lista de anos dava loaded=true e caia no ramo do "nada importado" -- a
  // dizer que a base esta vazia quando o que houve foi um erro.
  const loaded = shown.length > 0 && grids.every((g) => g.data);
  const failed = grids.some((g) => g.isError);
  // Predicado explicito: sem ele o tipo ficava (GridResponse | undefined)[] e as
  // funcoes abaixo nao aceitavam a lista.
  const data = grids
    .map((g) => g.data)
    .filter((d): d is GridResponse => d !== undefined);

  // Sem useMemo de proposito. O .map acima cria um array novo em cada render,
  // por isso um useMemo dependente dele nunca acertava na cache -- so pagava o
  // custo e dava a impressao errada de estar a poupar trabalho. Sao no maximo
  // seis grelhas e as duas funcoes sao somas simples.
  const totals = yearTotals(data);
  const series = cumulativeSavings(data);

  if (loading || !user) return null;

  const hidden = (years?.length ?? 0) - shown.length;

  function renderContent() {
    // O !loaded e o que interessa: com dados em cache vale mais mostrar os
    // graficos que ja la estavam do que uma linha vermelha. Um refetch falhado
    // nao e razao para apagar o que o utilizador esta a ler.
    if (yearsError && !loaded) {
      return (
        <p className="text-destructive">Could not load the list of years.</p>
      );
    }
    if (failed && !loaded) {
      return <p className="text-destructive">Could not load one of the years.</p>;
    }
    if (yearsPending || (shown.length > 0 && !loaded)) {
      // Duas faixas com a altura exacta dos graficos, em vez do esqueleto do
      // dashboard: este ecra tem outra forma, e um esqueleto que nao coincide
      // com o que carrega a seguir causa o reflow que ele existe para evitar.
      return (
        <div className="space-y-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (shown.length === 0) {
      return (
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">Nothing imported yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import a workbook on the dashboard and it will show up here.
          </p>
        </div>
      );
    }
    // Um ano sozinho nao se compara com nada, e um grafico com uma barra so
    // dava a entender que sim.
    if (shown.length === 1) {
      return (
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">Only {shown[0]} has data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There is nothing to compare it against yet. Import another year to
            see them side by side.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Cortar em silencio leria-se como "e isto que existe". */}
        {hidden > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing the {MAX_YEARS} most recent years. {hidden} older{" "}
            {hidden === 1 ? "year is" : "years are"} not shown.
          </p>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Year by year
          </h2>
          <YearTotalsChart totals={totals} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Savings, running total
          </h2>
          <CumulativeChart series={series} />
        </section>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-8 p-6 lg:p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Years</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm underline-offset-4 hover:underline">
            Back to dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {renderContent()}
    </main>
  );
}
