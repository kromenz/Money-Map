"use client";

import { useState } from "react";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import { formatEur, MONTH_LABELS } from "@/lib/format";
import { pendingNoticeView } from "@/lib/pending-notice";
import type { FlushResponse, RejectedPending } from "@/types/expense";

/**
 * Gastos registados enquanto o Excel tinha a folha aberta. Nao e um erro -- e um
 * estado de espera, e por isso nao usa as cores de destrutivo.
 *
 * As falhas, quando existem, aparecem por baixo da contagem no molde do
 * FolderScanNotice -- sem elas, um bloqueio que nao e o Excel (atributo
 * so-de-leitura, ACL, antivirus) deixava "close Excel" no ecra para sempre,
 * mesmo de Excel fechado, sem forma nenhuma de perceber porque.
 *
 * As rejeitadas sao outra coisa: fechar o Excel nao as resolve, porque a folha
 * nao tem a linha delas. Por isso tem lista propria e um botao para as tirar,
 * e nao entram na frase "close Excel".
 */
export function PendingNotice({
  count,
  busy,
  onApply,
  failures = [],
  rejected = [],
  onDiscard,
}: {
  count: number;
  busy: boolean;
  onApply: () => void;
  failures?: FlushResponse["failures"];
  rejected?: RejectedPending[];
  onDiscard: (id: string) => Promise<void>;
}) {
  const hidden = useHiddenValues();
  // Um id de cada vez: dois cliques seguidos na mesma linha mandavam dois
  // pedidos, e o segundo so servia para confundir.
  const [discarding, setDiscarding] = useState<string | null>(null);

  const view = pendingNoticeView({
    count,
    rejected: rejected.length,
    busy,
    discarding: discarding !== null,
  });
  if (!view.visible) return null;
  const { waiting } = view;

  async function discard(id: string) {
    setDiscarding(id);
    try {
      await onDiscard(id);
    } finally {
      setDiscarding(null);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      {view.showApply && (
        <div className="flex items-center gap-4">
          <p className="min-w-0 flex-1 text-sm">
            {waiting > 0 ? (
              <>
                {waiting === 1 ? "1 expense is" : `${waiting} expenses are`} waiting — close
                Excel to apply {waiting === 1 ? "it" : "them"}.
              </>
            ) : (
              "Fixed the sheet? Apply again to retry."
            )}
          </p>
          <button
            type="button"
            onClick={onApply}
            disabled={busy}
            className="shrink-0 rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50">
            {busy ? "Applying…" : "Apply now"}
          </button>
        </div>
      )}

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

      {rejected.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm">
            {rejected.length === 1
              ? "1 expense could not be applied"
              : `${rejected.length} expenses could not be applied`}
            . Add the missing row to the sheet and it will go in on the next apply, or discard it.
          </p>
          <ul className="space-y-1">
            {rejected.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 text-muted-foreground">
                  <span className="font-mono">
                    {MONTH_LABELS[r.month - 1]} {r.year}
                  </span>{" "}
                  · {r.name}
                  {r.note ? ` (${r.note})` : ""} · {formatEur(Number(r.amount), hidden)} —{" "}
                  {r.reason}
                </span>
                <button
                  type="button"
                  onClick={() => void discard(r.id)}
                  disabled={!view.canDiscard}
                  className="shrink-0 rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50">
                  {discarding === r.id ? "Discarding…" : "Discard"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
