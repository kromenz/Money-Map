"use client";

import type { FolderScanFailure } from "@/types/folder-scan";

/**
 * O que a pasta trazia e nao entrou. So aparece quando ha falhas: o sucesso e
 * silencioso, porque ver os numeros no dashboard ja e a confirmacao.
 */
export function FolderScanNotice({
  failed,
  onDismiss,
}: {
  failed: FolderScanFailure[];
  onDismiss: () => void;
}) {
  if (failed.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          Not everything in the folder was imported
        </p>
        <ul className="mt-2 space-y-1">
          {failed.map((f, i) => (
            // Indice na chave: os nomes vem da pasta e nada garante que sejam
            // unicos depois de filtrados.
            <li key={`${f.file}-${i}`} className="text-sm text-muted-foreground">
              <span className="font-mono">{f.file}</span> — {f.reason}
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
        ×
      </button>
    </div>
  );
}
