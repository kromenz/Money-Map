"use client";

/**
 * Gastos registados enquanto o Excel tinha a folha aberta. Nao e um erro -- e um
 * estado de espera, e por isso nao usa as cores de destrutivo.
 */
export function PendingNotice({
  count,
  busy,
  onApply,
}: {
  count: number;
  busy: boolean;
  onApply: () => void;
}) {
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-4 rounded-lg border bg-muted/40 p-4">
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
  );
}
