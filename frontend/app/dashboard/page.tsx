"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { FolderScanNotice } from "../../src/components/dashboard/FolderScanNotice";
import { fetchGrid } from "../../src/services/budget.service";
import { scanFolder } from "../../src/services/folder-scan.service";
import { yearMetrics, monthDetail } from "../../src/lib/budget-metrics";
import { categoryDeltas } from "../../src/lib/category-deltas";
import { MONTH_LABELS } from "../../src/lib/format";
import type { ImportResult } from "../../src/types/budget";
import type { FolderScanFailure } from "../../src/types/folder-scan";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth("/");
  const [year, setYear] = useState(new Date().getFullYear());
  // null significa "usa o predefinido" -- o ultimo mes com movimento. Guardar
  // um indice fixo apontaria para um mes vazio depois de trocar de ano.
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  // O relatorio vive aqui e nao dentro do ImportWorkbook: importar troca de ano,
  // e trocar de ano desmonta a instancia que o estava a mostrar.
  const [report, setReport] = useState<ImportResult | null>(null);

  // A pasta so se sabe configurada depois da primeira resposta do varrimento --
  // o caminho vive do lado servidor e nunca chega aqui.
  const [folderConfigured, setFolderConfigured] = useState(false);
  const [folderFailures, setFolderFailures] = useState<FolderScanFailure[]>([]);
  const [scanning, setScanning] = useState(false);

  // isPending cobre pending+fetching, pending+paused (offline) e
  // pending+disabled -- qualquer estado sem dados ainda, nao so "a carregar".
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["budget-grid", year],
    queryFn: () => fetchGrid(year),
    enabled: Boolean(user),
  });

  const queryClient = useQueryClient();
  const scanned = useRef(false);

  const metrics = useMemo(() => (data ? yearMetrics(data) : null), [data]);
  const activeMonth = selectedMonth ?? metrics?.lastActiveMonth ?? null;
  const detail = useMemo(
    () => (data && activeMonth !== null ? monthDetail(data, activeMonth) : null),
    [data, activeMonth]
  );
  const deltas = useMemo(
    () => (data && activeMonth !== null ? categoryDeltas(data, activeMonth) : []),
    [data, activeMonth]
  );

  // So depois de a grelha responder: esse pedido passa pelo interceptor que
  // renova o token, por isso a esta altura o cookie ja esta bom. Varrer antes
  // apanhava um 401 evitavel.
  useEffect(() => {
    if (!data || scanned.current) return;
    scanned.current = true;
    void runScan(false);
  }, [data]);

  async function runScan(force: boolean) {
    setScanning(true);
    try {
      const result = await scanFolder(force);

      if (result.status === "not-configured") {
        setFolderConfigured(false);
        setFolderFailures([]);
        return;
      }
      setFolderConfigured(true);

      // Sem sessao nao se guarda nada e deixa-se a porta aberta a nova
      // tentativa; o botao tambem serve para isso.
      if (result.status === "unauthenticated") {
        scanned.current = false;
        return;
      }

      setFolderFailures(result.failed);

      if (!result.fromCache && result.imported.length > 0) {
        await queryClient.invalidateQueries({ queryKey: ["budget-grid"] });
        await queryClient.invalidateQueries({ queryKey: ["budget-years"] });
      }
    } catch (err) {
      // O varrimento e um extra: o dashboard continua a servir com o
      // arrastar-e-largar mesmo que o route handler falhe. Mas a falha nao
      // pode ficar muda -- fica no log e na faixa, para nao parecer que a
      // pasta nunca esteve configurada.
      console.error("folder scan failed", err);
      setFolderConfigured(true);
      setFolderFailures([
        { file: "folder scan", year: null, reason: "the scan itself failed to run" },
      ]);
    } finally {
      setScanning(false);
    }
  }

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
    // Elemento de largar reutilizado nos dois ramos de recuperacao. Fora do
    // caminho feliz: com a pasta a carregar sozinha, um quadrado permanente ao
    // lado do resumo era so ruido.
    const dropZone = (
      <ImportWorkbook
        year={year}
        variant="square"
        onImportStart={() => setReport(null)}
        onImported={handleImported}
      />
    );

    if (isPending) return <DashboardSkeleton />;

    // Uma falha no carregamento nao pode deixar o utilizador sem forma de
    // importar -- a zona fica ao lado do erro, tal como no caminho feliz.
    if (isError) {
      return (
        <div className="flex flex-wrap items-start gap-6">
          {dropZone}
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
          {dropZone}
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
        {/* A faixa do ano: o resumo centrado com a largura toda, e o grafico
            por baixo. Importar vive na pasta e no botao do cabecalho. */}
        <YearSummary metrics={metrics} />

        <CashflowChart
          months={metrics.months}
          averages={metrics.averages}
          selectedMonth={activeMonth}
          onSelectMonth={setSelectedMonth}
        />

        <MonthPanel
          detail={detail}
          monthLabel={MONTH_LABELS[detail.month]}
          averages={metrics.averages}
          deltas={deltas}
        />
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
          {/* No cabecalho e nao ao lado do quadrado de largar: o ramo da base
              vazia usa a versao grande do ImportWorkbook, e o botao ficaria
              ausente precisamente onde mais se precisa dele. */}
          {folderConfigured && (
            <button
              type="button"
              onClick={() => void runScan(true)}
              disabled={scanning}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
              {scanning ? "Reloading…" : "Reload from folder"}
            </button>
          )}
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

      <FolderScanNotice
        failed={folderFailures}
        onDismiss={() => setFolderFailures([])}
      />

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
