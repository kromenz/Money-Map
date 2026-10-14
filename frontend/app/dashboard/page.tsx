"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { BudgetGrid } from "../../src/components/BudgetGrid";
import { ImportWorkbook } from "../../src/components/ImportWorkbook";
import { ImportReport } from "../../src/components/ImportReport";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { ValuesToggle } from "../../src/components/ValuesToggle";
import { YearPills } from "../../src/components/YearPills";
import { YearSummary } from "../../src/components/dashboard/YearSummary";
import { CashflowChart } from "../../src/components/dashboard/CashflowChart";
import { MonthPanel } from "../../src/components/dashboard/MonthPanel";
import { GroupComposition } from "../../src/components/dashboard/GroupComposition";
import { yearGroups } from "../../src/lib/year-comparison";
import { DashboardSkeleton } from "../../src/components/dashboard/DashboardSkeleton";
import { FolderScanNotice } from "../../src/components/dashboard/FolderScanNotice";
import { AddEntryBar } from "../../src/components/dashboard/AddEntryBar";
import { PendingNotice } from "../../src/components/dashboard/PendingNotice";
import { PhoneInboxNotice } from "../../src/components/dashboard/PhoneInboxNotice";
import { syncInbox } from "../../src/services/inbox.service";
import { phoneInboxMessage } from "../../src/lib/phone-inbox";
import { fetchGrid } from "../../src/services/budget.service";
import { scanFolder } from "../../src/services/folder-scan.service";
import { flushPending } from "../../src/services/expense.service";
import { discardPending } from "../../src/services/pending.service";
import { flushBridge } from "../../src/services/bridge.service";
import { yearMetrics, monthDetail } from "../../src/lib/budget-metrics";
import { categoryDeltas } from "../../src/lib/category-deltas";
import { MONTH_LABELS } from "../../src/lib/format";
import type { ImportResult } from "../../src/types/budget";
import type { FolderScanFailure } from "../../src/types/folder-scan";
import type { FlushResponse, RejectedPending } from "../../src/types/expense";

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
  const [pending, setPending] = useState(0);
  const [pendingFailures, setPendingFailures] = useState<FlushResponse["failures"]>([]);
  const [pendingRejected, setPendingRejected] = useState<RejectedPending[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<ReturnType<typeof phoneInboxMessage>>(null);

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
  const groups = useMemo(() => (data ? yearGroups(data) : []), [data]);

  // So depois de a grelha responder: esse pedido passa pelo interceptor que
  // renova o token, por isso a esta altura o cookie ja esta bom. Varrer antes
  // apanhava um 401 evitavel.
  useEffect(() => {
    if (!data || scanned.current) return;
    scanned.current = true;
    void runScan(false)
      // Entre o varrimento e a fila: o que chega do telemovel entra na fila, e
      // o applyPending a seguir escreve-o na mesma volta.
      .then(() => syncPhone())
      .then(() => applyPending())
      // A ponte por ultimo, e a seguir ao varrimento: e o varrimento que
      // importa a folha e faz o corte avancar, e correr a ponte antes disso
      // era escrever na folha meses que ela ja passou a cobrir.
      .then(() => applyBridge());
  }, [data]);

  /**
   * Descarrega na folha o que a ponte do Trading 212 ainda lhe deve.
   *
   * Silencioso de proposito, ao contrario do applyPending: os gastos pendentes
   * sao do utilizador e ele espera ve-los aparecer; isto e trabalho de fundo de
   * uma integracao que pode nem estar configurada. O que ficar por escrever
   * continua em divida no servidor e volta a ser tentado -- nada se perde por
   * nao ser dito aqui.
   */
  async function applyBridge() {
    try {
      const result = await flushBridge();
      if (result.written > 0) {
        await queryClient.invalidateQueries({ queryKey: ["budget-grid"] });
        await queryClient.invalidateQueries({ queryKey: ["budget-parcels"] });
      }
      // A folha ficou escrita mas o servidor nao soube: a proxima corrida
      // escreveria os mesmos valores outra vez. E o unico desfecho aqui que o
      // utilizador tem mesmo de ver.
      for (const failure of result.failures) {
        console.warn(`[bridge] ${failure.year}: ${failure.reason}`);
      }
    } catch (err) {
      console.error("bridge flush failed", err);
    }
  }

  /**
   * Vai a caixa do telemovel. Nunca rebenta a cadeia: sem internet, ou com o
   * Worker em baixo, o dashboard tem de abrir e a fila local tem de aplicar
   * na mesma. O backend volta a tentar no seu proprio tick.
   */
  async function syncPhone() {
    try {
      setPhoneMessage(phoneInboxMessage(await syncInbox()));
    } catch (err) {
      console.warn("phone inbox sync failed", err);
    }
  }

  // Aplicar a fila reescreve o ficheiro e reimporta, por isso a grelha tem de
  // ser reposta a zero -- e o mesmo motivo por que registar um gasto a invalida.
  async function applyPending() {
    setFlushing(true);
    try {
      const result = await flushPending();
      setPending(result.stillPending);
      setPendingFailures(result.failures);
      setPendingRejected(result.rejected);
      if (result.applied > 0) {
        await queryClient.invalidateQueries({ queryKey: ["budget-grid"] });
        await queryClient.invalidateQueries({ queryKey: ["budget-parcels"] });
      }
    } catch {
      // O aviso fica como esta e o botao volta a ficar clicavel. Uma falha aqui
      // nao perde nada: os pendentes continuam na fila.
    } finally {
      setFlushing(false);
    }
  }

  /**
   * Tira uma rejeitada da fila. Se o pedido falhar, a linha fica e o botao
   * volta a ficar clicavel -- nada se perdeu, porque a entrada continua no
   * servidor. Se outro separador ja a tinha tirado, o backend responde
   * cleared 0 sem erro e a linha sai na mesma, que e o que interessa.
   */
  async function discardRejected(id: string) {
    try {
      await discardPending(id);
    } catch (err) {
      console.error("discard pending failed", err);
      return;
    }
    setPendingRejected((rows) => rows.filter((r) => r.id !== id));
    setPending((n) => Math.max(0, n - 1));
  }

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
        await queryClient.invalidateQueries({ queryKey: ["budget-parcels"] });
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

    // PendingNotice e AddEntryBar acima de todos os ramos que se seguem: a
    // fila de pendentes nao depende do ano em vista, e num ano com categorias
    // mas sem movimento -- o caso de Janeiro de qualquer ano -- o utilizador
    // tem de conseguir registar o primeiro lancamento do ano mesmo assim.
    // AddEntryBar ja se esconde sozinho sem categorias nenhumas (rows
    // vazio inclusive), por isso passar data?.rows tal e qual e seguro mesmo
    // nos ramos de erro e vazio.
    const bar = (
      <>
        <PhoneInboxNotice message={phoneMessage} onDismiss={() => setPhoneMessage(null)} />
        <PendingNotice
          count={pending}
          busy={flushing}
          onApply={applyPending}
          failures={pendingFailures}
          rejected={pendingRejected}
          onDiscard={discardRejected}
        />
        <AddEntryBar
          year={year}
          rows={data?.rows ?? []}
          onWritten={() => {
            void queryClient.invalidateQueries({ queryKey: ["budget-grid", year] });
            // A reimportacao que a escrita faz tambem refez as parcelas; sem isto o
            // "What was bought" ficava a mostrar o mes de antes do lancamento.
            void queryClient.invalidateQueries({ queryKey: ["budget-parcels", year] });
          }}
          onPending={setPending}
        />
      </>
    );

    // Uma falha no carregamento nao pode deixar o utilizador sem forma de
    // importar -- a zona fica ao lado do erro, tal como no caminho feliz.
    if (isError) {
      return (
        <div className="space-y-6">
          {bar}
          <div className="flex flex-wrap items-start gap-6">
            {dropZone}
            <p className="text-destructive">
              Could not load the dashboard: {error.message}
            </p>
          </div>
        </div>
      );
    }

    // Nada importado: sem linhas nao ha nem estrutura de categorias. A zona de
    // largar e o proprio estado vazio -- a mensagem "importa acima" apontava
    // para o componente que agora esta aqui.
    if (!data || data.rows.length === 0) {
      return (
        <div className="space-y-6">
          {bar}
          <ImportWorkbook
            year={year}
            onImportStart={() => setReport(null)}
            onImported={handleImported}
          />
        </div>
      );
    }

    // Ha categorias mas nenhum mes tem movimento (lastActiveMonth === null).
    // O backend devolve sectionTotals para qualquer seccao com categorias, por
    // isso este caso e real e nao deve pedir uma importacao que ja foi feita --
    // a "Full table" logo abaixo mostra a estrutura toda.
    if (activeMonth === null || !metrics || !detail) {
      return (
        <div className="space-y-6">
          {bar}
          <div className="flex flex-wrap items-start gap-6">
            {dropZone}
            <div className="min-w-0 flex-1 rounded-lg border p-8 text-center">
              <p className="font-medium">No movement in {year}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The categories are imported, but no month has any amounts yet.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {bar}

        {/* A faixa do ano: o resumo centrado com a largura toda, e o grafico
            por baixo. Importar vive na pasta e no botao do cabecalho. */}
        <YearSummary metrics={metrics} />

        <CashflowChart
          months={metrics.months}
          averages={metrics.averages}
          selectedMonth={activeMonth}
          onSelectMonth={setSelectedMonth}
        />

        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Where it went this year
          </h3>
          <GroupComposition
            byGroup={groups}
            emptyMessage="No expenses this year"
          />
        </div>

        <MonthPanel
          detail={detail}
          monthLabel={MONTH_LABELS[detail.month]}
          averages={metrics.averages}
          deltas={deltas}
          year={year}
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
          <Link
            href="/years"
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Compare years
          </Link>
          <Link href="/investments" className="text-sm text-muted-foreground hover:text-foreground">
            Investments
          </Link>
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
          <ValuesToggle />
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
          {/* O mes em foco no dashboard fica destacado tambem na grelha, para
              as duas vistas nao contarem historias separadas. */}
          <BudgetGrid year={year} selectedMonth={activeMonth} />
        </div>
      </details>
    </main>
  );
}
