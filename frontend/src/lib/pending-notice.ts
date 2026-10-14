export type PendingNoticeView = {
  visible: boolean;
  /** As que esperam que o Excel largue a folha -- sem as rejeitadas. */
  waiting: number;
  showApply: boolean;
  canDiscard: boolean;
};

/**
 * O que o aviso da fila mostra, tirado do componente para se poder testar.
 *
 * O botao de aplicar fica tambem quando so restam rejeitadas: o texto manda
 * acrescentar a linha a folha e diz que entra na proxima aplicacao, e sem o
 * botao nada no ecra a disparava.
 *
 * Descartar fica bloqueado durante um flush. O flush pode ja ter a entrada no
 * lote pronto, e descarta-la a meio deixava na folha um gasto que o
 * utilizador mandou tirar.
 */
export function pendingNoticeView(input: {
  count: number;
  rejected: number;
  busy: boolean;
  discarding: boolean;
}): PendingNoticeView {
  const { count, rejected, busy, discarding } = input;
  // count vem do flush (ou do AddEntryBar) e ja inclui as rejeitadas.
  const waiting = Math.max(0, count - rejected);
  const visible = waiting > 0 || rejected > 0;
  return {
    visible,
    waiting,
    showApply: visible,
    canDiscard: !busy && !discarding,
  };
}
