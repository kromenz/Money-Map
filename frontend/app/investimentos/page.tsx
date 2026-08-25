"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { fetchOverview, syncNow } from "../../src/services/t212.service";
import { PortfolioSummary } from "../../src/components/t212/PortfolioSummary";
import { SyncStatus } from "../../src/components/t212/SyncStatus";
import { NotConfigured } from "../../src/components/t212/NotConfigured";
import { ThemeToggle } from "../../src/components/ThemeToggle";

export default function InvestimentosPage() {
  const { user, loading } = useRequireAuth("/");
  const queryClient = useQueryClient();
  const [syncError, setSyncError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["t212-overview"],
    queryFn: fetchOverview,
    enabled: Boolean(user),
  });

  const sync = useMutation({
    mutationFn: syncNow,
    onSuccess: (report) => {
      const falhadas = report.stages.filter((s) => !s.ok);
      setSyncError(
        falhadas.length
          ? `Etapas com erro: ${falhadas.map((s) => s.kind).join(", ")}`
          : null
      );
      // Tudo o que a pagina mostra vem do espelho, portanto tudo re-le.
      queryClient.invalidateQueries({ queryKey: ["t212-overview"] });
      queryClient.invalidateQueries({ queryKey: ["t212-chart"] });
    },
    onError: (err: unknown) => {
      setSyncError(err instanceof Error ? err.message : "Sincronizacao falhou");
    },
  });

  if (loading || isPending) {
    return <div className="p-8 text-sm text-muted-foreground">A carregar…</div>;
  }

  if (isError || !data) {
    return <div className="p-8 text-sm text-destructive">Nao foi possivel ler os investimentos.</div>;
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Investimentos</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Orcamento
          </Link>
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

          {syncError ? (
            <p className="text-xs text-destructive">{syncError}</p>
          ) : null}

          {data.cutoff ? (
            <p className="text-xs text-muted-foreground">
              Movimentos anteriores a {data.cutoff} aparecem aqui mas nao entram
              na grelha do orcamento — nesses meses ja estao representados pela
              folha.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
