"use client";

import type { SyncStatus as Status } from "@/types/t212";

const LABELS: Record<string, string> = {
  positions: "Carteira",
  summary: "Conta",
  orders: "Ordens",
  dividends: "Dividendos",
  transactions: "Caixa",
};

function when(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-PT");
}

/**
 * Por etapa e nao um estado global: posicoes actualizadas com dividendos em
 * falta e um resultado legitimo, e escondê-lo atras de um "erro" unico daria a
 * entender que nada foi sincronizado.
 */
export function SyncStatus({
  status,
  onSync,
  syncing,
}: {
  status: Status[];
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
      {status.map((s) => (
        <span key={s.kind} className="flex items-center gap-1">
          <span className={s.lastError ? "text-destructive" : ""}>
            {LABELS[s.kind] ?? s.kind}
          </span>
          <span className="tabular-nums">{when(s.lastRunAt)}</span>
          {s.lastError ? (
            <span className="text-destructive" title={s.lastError}>
              — falhou
            </span>
          ) : null}
        </span>
      ))}

      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="rounded-md border px-3 py-1 text-xs font-medium text-foreground disabled:opacity-50"
      >
        {syncing ? "A sincronizar…" : "Sincronizar agora"}
      </button>
    </div>
  );
}
