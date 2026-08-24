import type { NewExpense, PendingExpense, Section } from "@/types/expense";

export type YearBatch = {
  year: number;
  /** Os ids a limpar, mas so depois de o import desse ano aceitar. */
  ids: string[];
  expenses: NewExpense[];
};

/**
 * Agrupa a fila por ano.
 *
 * Um lote por ano e nao um por gasto: cada aplicacao reescreve o ficheiro e
 * corre um import completo, e fazer isso por gasto seria pago N vezes sem
 * ganho nenhum.
 *
 * A ordem de chegada mantem-se dentro do ano. Nao muda o total, mas muda a
 * formula que fica na celula, e essa formula e para ser lida no Excel.
 */
export function groupPendingByYear(pending: PendingExpense[]): YearBatch[] {
  const byYear = new Map<number, YearBatch>();

  for (const p of pending) {
    let batch = byYear.get(p.year);
    if (!batch) {
      batch = { year: p.year, ids: [], expenses: [] };
      byYear.set(p.year, batch);
    }

    batch.ids.push(p.id);
    batch.expenses.push({
      section: p.section as Section,
      group: p.group,
      name: p.name,
      month: p.month,
      amount: Number(p.amount),
    });
  }

  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
