"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { BudgetGrid } from "../../src/components/BudgetGrid";
import { ImportWorkbook } from "../../src/components/ImportWorkbook";
import { ImportReport } from "../../src/components/ImportReport";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { YearPills } from "../../src/components/YearPills";
import { YearSummary } from "../../src/components/dashboard/YearSummary";
import { CashflowChart } from "../../src/components/dashboard/CashflowChart";
import { MonthPanel } from "../../src/components/dashboard/MonthPanel";
import { DashboardSkeleton } from "../../src/components/dashboard/DashboardSkeleton";
import { fetchGrid } from "../../src/services/budget.service";
import { yearMetrics, monthDetail } from "../../src/lib/budget-metrics";
import { MONTH_LABELS } from "../../src/lib/format";
import type { ImportResult } from "../../src/types/budget";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth("/");
  const [year, setYear] = useState(new Date().getFullYear());
  // null significa "usa o predefinido" -- o ultimo mes com movimento. Guardar
  // um indice fixo apontaria para um mes vazio depois de trocar de ano.
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  // O relatorio vive aqui e nao dentro do ImportWorkbook: importar troca de ano,
  // e trocar de ano desmonta a instancia que o estava a mostrar.
  const [report, setReport] = useState<ImportResult | null>(null);

  // isPending cobre pending+fetching, pending+paused (offline) e
  // pending+disabled -- qualquer estado sem dados ainda, nao so "a carregar".
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["budget-grid", year],
    queryFn: () => fetchGrid(year),
    enabled: Boolean(user),
  });

  const metrics = useMemo(() => (data ? yearMetrics(data) : null), [data]);
  const activeMonth = selectedMonth ?? metrics?.lastActiveMonth ?? null;
  const detail = useMemo(
    () => (data && activeMonth !== null ? monthDetail(data, activeMonth) : null),
    [data, activeMonth]
  );

  if (loading || !user) return null;

  // Um import que falha a verificacao nao gravou nada. Saltar para esse ano
  // deixava o utilizador num ano vazio, a ler um relatorio sobre um ano que ja
  // nao esta a ver.
  function handleImported(result: ImportResult) {
    setReport(result);
    if (result.allMatch) {
      setYear(result.year);
      setSelectedMonth(null);
    }
  }

  // Ramos mutuamente exclusivos por construcao (early return), nao por
  // combinacoes de flags: uma falha no refetch em segundo plano (ex.: apos
  // importar um ficheiro) mantem os dados antigos em cache, por isso o erro
  // tem de ganhar ao grelha em vez de as duas aparecerem empilhadas.
  function renderContent() {
    if (isPending) return <DashboardSkeleton />;

    // Uma falha no carregamento nao pode deixar o utilizador sem forma de
    // importar -- a zona fica ao lado do erro, tal como no caminho feliz.
    if (isError) {
      return (
        <div className="flex flex-wrap items-start gap-6">
          <ImportWorkbook
            year={year}
            variant="square"
            onImportStart={() => setReport(null)}
            onImported={handleImported}
          />
          <p className="text-destructive">
            Could not load the dashboard: {error.message}
          </p>
        </div>
      );
    }

    // Nada importado: sem linhas nao ha nem estrutura de categorias. A zona de
    // largar e o proprio estado vazio -- a mensagem "importa acima" apontava
    // para o componente que agora esta aqui.
    if (!data || data.rows.length === 0) {
      return (
        <ImportWorkbook
          year={year}
          onImportStart={() => setReport(null)}
          onImported={handleImported}
        />
      );
    }

    // Ha categorias mas nenhum mes tem movimento (lastActiveMonth === null).
    // O backend devolve sectionTotals para qualquer seccao com categorias, por
    // isso este caso e real e nao deve pedir uma importacao que ja foi feita --
    // a "Full table" logo abaixo mostra a estrutura toda.
    if (activeMonth === null || !metrics || !detail) {
      return (
        <div className="flex flex-wrap items-start gap-6">
          <ImportWorkbook
            year={year}
            variant="square"
            onImportStart={() => setReport(null)}
            onImported={handleImported}
          />
          <div className="min-w-0 flex-1 rounded-lg border p-8 text-center">
            <p className="font-medium">No movement in {year}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The categories are imported, but no month has any amounts yet.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* A faixa do ano: quadrado de largar a esquerda, resumo ao lado, e o
            grafico com a largura toda por baixo. */}
        <div className="flex flex-wrap items-start gap-6">
          <ImportWorkbook
            year={year}
            variant="square"
            onImportStart={() => setReport(null)}
            onImported={handleImported}
          />
          <div className="min-w-0 flex-1">
            <YearSummary year={year} metrics={metrics} />
          </div>
        </div>

        <CashflowChart
          months={metrics.months}
          averages={metrics.averages}
          selectedMonth={activeMonth}
          onSelectMonth={setSelectedMonth}
        />

        <MonthPanel detail={detail} monthLabel={MONTH_LABELS[detail.month]} />
      </div>
    );
  }

  return (
    // A grelha completa tem 14 colunas (categoria + 12 meses + ano). Com
    // max-w-[1400px] e p-8 sobravam ~1300px e nao cabiam sem scroll lateral.
    <main className="mx-auto w-full max-w-[1800px] space-y-8 p-6 lg:p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Budget</h1>
        <div className="flex items-center gap-2">
          <YearPills
            year={year}
            onSelect={(y) => {
              setYear(y);
              setSelectedMonth(null);
              // O relatorio nao tem ano nenhum escrito no ecra -- navegar para
              // outro ano sem o limpar deixava-o a descrever, em silencio, um
              // ano que ja nao esta a ser visto.
              setReport(null);
            }}
          />
          <ThemeToggle />
        </div>
      </header>

      {report && <ImportReport result={report} />}

      {renderContent()}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Full table
        </summary>
        <div className="mt-4">
          <BudgetGrid year={year} />
        </div>
      </details>
    </main>
  );
}
