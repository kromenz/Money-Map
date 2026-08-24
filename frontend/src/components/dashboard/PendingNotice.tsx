"use client";

import type { FlushResponse } from "@/types/expense";

/**
 * Gastos registados enquanto o Excel tinha a folha aberta. Nao e um erro -- e um
 * estado de espera, e por isso nao usa as cores de destrutivo.
 *
 * As falhas, quando existem, aparecem por baixo da contagem no molde do
 * FolderScanNotice -- sem elas, um bloqueio que nao e o Excel (atributo
 * so-de-leitura, ACL, antivirus) deixava "close Excel" no ecra para sempre,
 * mesmo de Excel fechado, sem forma nenhuma de perceber porque.
 */
export function PendingNotice({
  count,
  busy,
  onApply,
  failures = [],
}: {
  count: number;
  busy: boolean;
  onApply: () => void;
  failures?: FlushResponse["failures"];
}) {
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex items-center gap-4">
        <p className="min-w-0 flex-1 text-sm">
          {count === 1 ? "1 expense is" : `${count} expenses are`} waiting — close
          Excel to apply {count === 1 ? "it" : "them"}.
        </p>
        <button
          type="button"
          onClick={onApply}
          disabled={busy}
          className="shrink-0 rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50">
          {busy ? "Applying…" : "Apply now"}
        </button>
      </div>

      {failures.length > 0 && (
        <ul className="space-y-1">
          {failures.map((f, i) => (
            // Indice na chave: o mesmo ano pode aparecer mais do que uma vez
            // entre chamadas, e nada garante unicidade so pelo ano.
            <li key={`${f.year}-${i}`} className="text-sm text-muted-foreground">
              <span className="font-mono">{f.year}</span> — {f.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
