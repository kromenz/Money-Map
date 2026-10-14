"use client";

/**
 * O que chegou do telemovel nesta visita. Informativo, como o PendingNotice:
 * nao usa as cores de destrutivo, nem quando ha entradas por ler -- essas
 * continuam guardadas na caixa, nada se perdeu.
 */
export function PhoneInboxNotice({
  message,
  onDismiss,
}: {
  message: { headline: string; details: string[] } | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
      <div className="flex items-center gap-4">
        <p className="min-w-0 flex-1 text-sm">{message.headline}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md border px-3 py-1 text-sm hover:bg-muted">
          Dismiss
        </button>
      </div>
      {message.details.length > 0 && (
        <ul className="space-y-1">
          {message.details.map((d) => (
            <li key={d} className="text-sm text-muted-foreground">
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
