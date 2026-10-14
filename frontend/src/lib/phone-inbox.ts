import type { InboxSyncResponse } from "@/types/inbox";

/**
 * "arrived" e nao "applied": os registos entram na fila normal, e com o Excel
 * aberto ou uma linha em falta nao sao aplicados ja -- isso e o PendingNotice
 * que diz. Dizer "applied" aqui era mentir nesses casos.
 */
export function phoneInboxMessage(
  result: InboxSyncResponse | null
): { headline: string; details: string[] } | null {
  if (!result) return null;
  const { received } = result;
  const failed = result.failures.length;
  if (received === 0 && failed === 0) return null;

  const parts: string[] = [];
  if (received > 0) {
    parts.push(`${received} ${received === 1 ? "entry" : "entries"} arrived from your phone.`);
  }
  if (failed > 0) {
    const waiting = failed === 1 ? "is still waiting" : "are still waiting";
    parts.push(
      received > 0
        ? `${failed} could not be read and ${waiting} in the inbox.`
        : `${failed} ${failed === 1 ? "entry" : "entries"} from your phone could not be read and ${waiting} in the inbox.`
    );
  }

  return {
    headline: parts.join(" "),
    details: [...new Set(result.failures.map((f) => f.reason))],
  };
}
