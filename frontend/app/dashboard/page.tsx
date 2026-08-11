"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { BudgetGrid } from "../../src/components/BudgetGrid";
import { ImportWorkbook } from "../../src/components/ImportWorkbook";
import { ImportReport } from "../../src/components/ImportReport";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { YearPills } from "../../src/components/YearPills";
import { YearRail } from "../../src/components/dashboard/YearRail";
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

    if (isError) {
      return (
        <p className="text-destructive">
          Could not load the dashboard: {error.message}
        </p>
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
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">No movement in {year}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The categories are imported, but no month has any amounts yet.
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <YearRail
            year={year}
            metrics={metrics}
            selectedMonth={activeMonth}
            onSelectMonth={setSelectedMonth}
          />
        </div>
        <div className="lg:col-span-2">
          <MonthPanel detail={detail} monthLabel={MONTH_LABELS[detail.month]} />
        </div>
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

      {/* A zona compacta cobre o erro e os dados-com-linhas; o skeleton (isPending)
          e o estado vazio (dentro de renderContent) tem cada um a sua propria
          zona de importar, para as duas nunca aparecerem ao mesmo tempo. */}
      {!isPending && (isError || (data && data.rows.length > 0)) && (
        <ImportWorkbook
          year={year}
          compact
          onImportStart={() => setReport(null)}
          onImported={handleImported}
        />
      )}

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
