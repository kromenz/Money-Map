"use client";

import { useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { fetchChart, fetchOverview, syncNow } from "../../src/services/t212.service";
import { PortfolioSummary } from "../../src/components/t212/PortfolioSummary";
import { SyncStatus } from "../../src/components/t212/SyncStatus";
import { PortfolioChart } from "../../src/components/t212/PortfolioChart";
import { HoldingsTable } from "../../src/components/t212/HoldingsTable";
import { DividendsPanel } from "../../src/components/t212/DividendsPanel";
import { OrdersTable } from "../../src/components/t212/OrdersTable";
import { CashFlowTable } from "../../src/components/t212/CashFlowTable";
import { NotConfigured } from "../../src/components/t212/NotConfigured";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { ValuesToggle } from "../../src/components/ValuesToggle";
import { t212StageLabel } from "../../src/lib/t212-labels";

// O detalhe tecnico (mensagem crua do axios) vive so no title, nunca no
// texto visivel -- o resto da pagina evita erros crus de proposito.
//
// O tom separa "correu mal" de "ja esta a correr": um 409 do /t212/sync nao e
// uma falha, e a corrida anterior a dizer que ainda vai a meio. Pinta-lo de
// vermelho fazia o utilizador carregar outra vez a tentar resolver o que nao
// tem problema nenhum.
type SyncNotice = { tone: "error" | "info"; message: string; detail?: string };

export default function InvestmentsPage() {
  const { user, loading } = useRequireAuth("/");
  const queryClient = useQueryClient();
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["t212-overview"],
    queryFn: fetchOverview,
    enabled: Boolean(user),
  });

  // So arranca depois de o overview confirmar "configured": sem chave a rota
  // do grafico responde 503, e a pagina mostraria um erro em vez do painel
  // de configuracao.
  const chart = useQuery({
    queryKey: ["t212-chart"],
    queryFn: fetchChart,
    enabled: Boolean(user) && Boolean(data?.configured),
  });

  const sync = useMutation({
    mutationFn: syncNow,
    onSuccess: (report) => {
      const failed = report.stages.filter((s) => !s.ok);
      // O `deleted` da etapa da ponte era calculado, tipado, e nunca mostrado.
      // O caso que o motivou -- importar uma folha nova, o corte avancar, e o
      // sync seguinte apagar dezenas de linhas do orcamento -- e visivel na
      // grelha e so aqui e que ha contexto para o explicar.
      const removed = report.stages.find((s) => s.kind === "bridge")?.deleted ?? 0;

      const lines: string[] = [];
      if (failed.length) {
        lines.push(
          `Stages with errors: ${failed.map((s) => t212StageLabel(s.kind)).join(", ")}`
        );
      }
      if (removed > 0) {
        lines.push(
          removed === 1
            ? "1 broker movement left the budget grid: the spreadsheet already covers that month and now represents it."
            : `${removed} broker movements left the budget grid: the spreadsheet already covers those months and now represents them.`
        );
      }

      setSyncNotice(
        lines.length
          ? { tone: failed.length ? "error" : "info", message: lines.join(" ") }
          : null
      );
      // Tudo o que a pagina mostra vem do espelho, portanto tudo re-le -- as
      // cinco chaves, nao so as duas do topo. Os dividendos, as ordens e a caixa
      // eram as tabelas que o primeiro backfill enche, e ficavam vazias depois
      // de sincronizar sem nada a sugerir um refrescamento.
      //
      // As tres ultimas chaves levam parametros a seguir (ano, filtros, pagina).
      // O React Query faz correspondencia por prefixo, portanto a primeira
      // parte da chave chega para invalidar todas as paginas e filtros.
      for (const key of [
        "t212-overview",
        "t212-chart",
        "t212-dividends",
        "t212-orders",
        "t212-cashflows",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err: unknown) => {
      // 409 nao e erro: o servidor recusou porque ja ha uma corrida a decorrer
      // -- o agendador arranca uma ao abrir a app, e o botao apanha-a a meio.
      // O limite de pedidos da T212 e por conta, portanto correr duas ao mesmo
      // tempo era pior do que esperar.
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setSyncNotice({
          tone: "info",
          message:
            "A sync is already running. The numbers will update once it finishes.",
        });
        return;
      }

      // A mensagem do axios ("Request failed with status code 500") nao diz o
      // que fazer a seguir. O detalhe tecnico fica na consola e no title.
      console.error("t212 sync failed", err);
      setSyncNotice({
        tone: "error",
        message: "The sync never ran: the server did not respond as expected.",
        detail: err instanceof Error ? err.message : undefined,
      });
    },
  });

  if (loading || isPending) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (isError || !data) {
    return <div className="p-8 text-sm text-destructive">Could not load the investments.</div>;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Investments</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Budget
          </Link>
          <ValuesToggle />
          <ThemeToggle />
        </div>
      </header>

      {!data.configured ? (
        <NotConfigured />
      ) : (
        <>
          <PortfolioSummary snapshot={data.snapshot} />

          <SyncStatus
            status={data.status}
            onSync={() => sync.mutate()}
            syncing={sync.isPending}
          />

          <PortfolioChart points={chart.data ?? []} />

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium">Holdings</h2>
            <HoldingsTable holdings={data.holdings} />
          </section>

          <DividendsPanel />
          <OrdersTable />
          <CashFlowTable />

          {syncNotice ? (
            <p
              className={
                syncNotice.tone === "error"
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
              title={syncNotice.detail}
            >
              {syncNotice.message}
            </p>
          ) : null}

          {data.cutoff ? (
            <p className="text-xs text-muted-foreground">
              Movements before {data.cutoff} show up here but do not enter the
              budget grid — in those months the spreadsheet already represents
              them.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
