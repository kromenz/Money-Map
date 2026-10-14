import { locateCells, SheetTargetError } from "./sheet-locate";
import type { YearBatch } from "./pending-plan";

export type RejectedEntry = { id: string; reason: string };

export type CheckedBatch = {
  /** O mesmo lote, so com as entradas que a folha tem onde por. */
  ready: YearBatch;
  rejected: RejectedEntry[];
};

/**
 * A mesma frase da ponte do Trading 212 (app/api/bridge/flush/route.ts), para
 * as duas falhas se lerem da mesma maneira no ecra.
 */
export function missingRowReason(
  year: number,
  missing: { section: string; group: string; name: string }
): string {
  const where = missing.group === "" ? missing.section : `${missing.section} › ${missing.group}`;
  return `the ${year} sheet has no "${missing.name}" row under ${where}`;
}

/**
 * Separa as entradas de um ano entre as que a folha consegue receber e as que
 * nao consegue.
 *
 * Existe porque o applyExpenses aplica o lote todo ou nada: uma so categoria
 * que a folha ja nao tem prendia o ano inteiro na fila, para sempre, sem dizer
 * qual era. Com o telemovel a mandar gastos de um catalogo que pode estar
 * desactualizado, isso deixava de ser raro.
 *
 * So a falta da linha e culpa da entrada -- e o unico SheetTargetError com
 * `missing`. Tudo o resto (ficheiro ilegivel, sem cabecalho, sem folha) e
 * defeito do ficheiro e sobe, para o ano falhar com uma razao so. Rejeitar
 * cada entrada nesses casos convidava o utilizador a descartar gastos bons.
 *
 * Localiza-se sobre o ficheiro original, como no applyExpenses: as linhas nao
 * se movem ao escrever, so os valores.
 */
export async function checkBatch(
  file: Uint8Array,
  batch: YearBatch
): Promise<CheckedBatch> {
  const ready: YearBatch = { year: batch.year, ids: [], expenses: [] };
  const rejected: RejectedEntry[] = [];

  for (let i = 0; i < batch.ids.length; i += 1) {
    const expense = batch.expenses[i];
    try {
      await locateCells(file, expense);
    } catch (err) {
      if (err instanceof SheetTargetError && err.missing) {
        rejected.push({ id: batch.ids[i], reason: missingRowReason(batch.year, err.missing) });
        continue;
      }
      throw err;
    }
    ready.ids.push(batch.ids[i]);
    ready.expenses.push(expense);
  }

  return { ready, rejected };
}
