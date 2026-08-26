import type { NewExpense } from "@/types/expense";
import type { SheetEdit } from "@/types/bridge";

export type BridgeYearBatch = {
  year: number;
  /** As parcelas originais, para se saber quantas o ano levava. */
  edits: SheetEdit[];
  /** O que vai para o applyExpenses. */
  expenses: NewExpense[];
  /** O que volta ao servidor como escrito, mas so depois de a folha aceitar. */
  written: { externalId: string; amount: string }[];
};

/**
 * Agrupa as parcelas da ponte por ano.
 *
 * Um lote por ano e nao um por parcela, pelo mesmo motivo do groupPendingByYear:
 * cada aplicacao reescreve o ficheiro inteiro e corre um import completo, e
 * pagar isso por parcela seria pagar N vezes sem ganho nenhum.
 *
 * Uma parcela com delta zero nao chega aqui -- o servidor ja a filtra --, mas
 * filtra-se na mesma: um "+0" escrito na formula sujava-a para sempre sem mudar
 * valor nenhum, e esta funcao nao pode depender de quem a chama para o evitar.
 */
export function groupEditsByYear(edits: SheetEdit[]): BridgeYearBatch[] {
  const byYear = new Map<number, BridgeYearBatch>();

  for (const edit of edits) {
    const delta = Number(edit.delta);
    if (!Number.isFinite(delta) || delta === 0) continue;

    let batch = byYear.get(edit.year);
    if (!batch) {
      batch = { year: edit.year, edits: [], expenses: [], written: [] };
      byYear.set(edit.year, batch);
    }

    batch.edits.push(edit);
    batch.expenses.push({
      section: edit.section,
      group: edit.group,
      name: edit.name,
      month: edit.month,
      amount: delta,
      note: edit.note,
    });
    batch.written.push({ externalId: edit.externalId, amount: edit.amount });
  }

  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
