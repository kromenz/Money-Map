import { NextResponse } from "next/server";
import { applyExpenses } from "@/lib/xlsx-package";
import { groupPendingByYear } from "@/lib/pending-plan";
import { checkBatch } from "@/lib/pending-check";
import {
  budgetFolder,
  clearPendingRetrying,
  fetchPending,
  isExcelLock,
  isLocked,
  readYear,
  SheetMissingError,
  withFolderLock,
  writeYear,
} from "@/server/budget-file";
import type { FlushResponse, PendingExpense } from "@/types/expense";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const folder = budgetFolder();
  const empty: FlushResponse = { applied: 0, stillPending: 0, failures: [], rejected: [] };
  if (!folder) return NextResponse.json(empty);

  const cookie = request.headers.get("cookie") ?? "";

  return withFolderLock(async () => {
    const pending = await fetchPending(cookie);
    const batches = groupPendingByYear(pending);
    // O lote so traz ids e o que a folha precisa; o ecra precisa da entrada
    // inteira para dizer qual foi rejeitada.
    const byId = new Map<string, PendingExpense>(pending.map((p) => [p.id, p]));

    let applied = 0;
    let stillPending = 0;
    const failures: FlushResponse["failures"] = [];
    const rejected: FlushResponse["rejected"] = [];

    for (const batch of batches) {
      // Um ano trancado nao impede os outros: cada ano e o seu proprio ficheiro.
      let locked: boolean;
      try {
        locked = await isLocked(folder, batch.year);
      } catch (err) {
        // A fila pode ter entradas para um ano cuja folha ja nao esta na
        // pasta -- a fila sobrevive ao conteudo da pasta. Sem isto, o
        // isLocked lancava aqui fora do try e um unico ano sem folha
        // interrompia o flush inteiro, deixando pendentes tambem os anos
        // que estavam bem. Isolamos este ano e deixamos os outros seguir.
        if (err instanceof SheetMissingError) {
          stillPending += batch.ids.length;
          failures.push({
            year: batch.year,
            reason: `there is no sheet for ${batch.year} in the budget folder`,
          });
          continue;
        }
        throw err;
      }

      if (locked) {
        stillPending += batch.ids.length;
        // O bloqueio pode nao ser o Excel: um atributo so-de-leitura, uma
        // ACL, um antivirus. Sem esta distincao o utilizador ficava com
        // "close Excel" para sempre mesmo de Excel fechado, sem forma de
        // perceber porque. Quando o marcador do Excel esta presente o
        // comportamento fica como estava -- sem entrada em failures.
        if (!(await isExcelLock(folder, batch.year))) {
          failures.push({
            year: batch.year,
            reason: `the sheet for ${batch.year} could not be opened, and Excel does not appear to have it open`,
          });
        }
        continue;
      }

      // Fora do try: o catch tem de saber quantas ainda estavam por aplicar.
      // Se o checkBatch rebentar, sao todas -- ready continua a ser o lote.
      let ready = batch;
      try {
        const file = await readYear(folder, batch.year);

        // Antes de escrever: uma entrada sem linha na folha ficava a prender
        // o ano inteiro. Assim so ela fica, com a sua razao.
        const checked = await checkBatch(file, batch);
        ready = checked.ready;
        for (const r of checked.rejected) {
          const entry = byId.get(r.id);
          if (entry) rejected.push({ ...entry, reason: r.reason });
        }
        stillPending += checked.rejected.length;

        // Nada para escrever: reescrever e reimportar a folha seria trabalho
        // (e um backup) sem mudar uma celula.
        if (ready.ids.length === 0) continue;

        const written = await applyExpenses(file, ready.expenses);
        const result = await writeYear(folder, batch.year, written, cookie);

        // "=== false" e nao "!result.ok": sem strictNullChecks (tsconfig
        // deste projecto), a negacao nao estreita a uniao discriminada e o
        // tsc reclama que "reason" nao existe.
        if (result.ok === false) {
          if (result.alreadyWritten) {
            // A folha ja tem o gasto -- a reposicao do backup falhou depois
            // do rename. Enfileirar de novo escrevia-o outra vez no proximo
            // flush, duplicando-o na folha do utilizador. Tenta-se limpar
            // estes ids da fila com retentativas (as mesmas do item B); se
            // mesmo assim falhar, ficam por limpar mas a razao ja avisa
            // claramente que nao se deve reaplicar.
            const cleared = await clearPendingRetrying(cookie, ready.ids);
            if (!cleared) stillPending += ready.ids.length;
            failures.push({ year: batch.year, reason: result.reason });
            continue;
          }
          stillPending += ready.ids.length;
          failures.push({ year: batch.year, reason: result.reason });
          continue;
        }

        // So depois de o import aceitar. Limpar antes perdia os gastos se o
        // import revertesse. Com retentativas (item B): uma quebra so
        // transitoria no pedido de limpeza nao deixa a fila suja; nao fecha
        // a janela por completo -- ver o comentario em clearPendingRetrying.
        const cleared = await clearPendingRetrying(cookie, ready.ids);
        if (!cleared) {
          // A folha ja tem os gastos escritos -- o import aceitou. Mas os
          // ids continuam na fila, por isso NAO contam como aplicados: se
          // contassem, a proxima montagem via applyPending() voltava a
          // escrever os mesmos gastos, duplicando-os em silencio na folha do
          // utilizador. A razao fica bem distinta das outras para nao ser
          // confundida com uma falha de escrita.
          stillPending += ready.ids.length;
          failures.push({
            year: batch.year,
            reason: `the sheet for ${batch.year} was updated but the pending queue could not be cleared afterwards — do not reapply, it would duplicate these expenses`,
          });
          continue;
        }

        applied += ready.ids.length;
      } catch {
        stillPending += ready.ids.length;
        failures.push({
          year: batch.year,
          reason: `the sheet for ${batch.year} could not be updated`,
        });
      }
    }

    return NextResponse.json({ applied, stillPending, failures, rejected } satisfies FlushResponse);
  });
}
