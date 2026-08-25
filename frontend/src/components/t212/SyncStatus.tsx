"use client";

import { t212StageLabel } from "@/lib/t212-labels";
import type { SyncStatus as Status } from "@/types/t212";

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
            {t212StageLabel(s.kind)}
          </span>
          <span className="tabular-nums">{when(s.lastRunAt)}</span>
          {s.lastError ? (
            <span className="text-destructive" title={s.lastError}>
              — falhou
            </span>
          ) : null}
          {/* Nao alarmante, mas visivel: uma etapa que saltou itens no Zod nao
              pode parecer identica a uma que correu limpa -- foi assim que
              sete posicoes desapareceram em silencio com ok:true no painel. */}
          {s.lastSkipped > 0 ? (
            <span
              className="text-amber-600 dark:text-amber-500"
              title={`${s.lastSkipped} ${s.lastSkipped === 1 ? "item saltado" : "itens saltados"} na ultima corrida`}
            >
              — {s.lastSkipped} {s.lastSkipped === 1 ? "saltado" : "saltados"}
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
