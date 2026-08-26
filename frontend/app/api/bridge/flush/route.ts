import { NextResponse } from "next/server";
import { applyExpenses } from "@/lib/xlsx-package";
import { SheetTargetError } from "@/lib/sheet-locate";
import { groupEditsByYear } from "@/lib/bridge-plan";
import {
  budgetFolder,
  fetchBridgePending,
  isExcelLock,
  isLocked,
  markBridgeWritten,
  readYear,
  SheetMissingError,
  withFolderLock,
  writeYear,
} from "@/server/budget-file";
import type { BridgeFlushResponse } from "@/types/bridge";

// Le e escreve no disco, por isso nao pode correr no runtime edge.
export const runtime = "nodejs";

/**
 * Descarrega para a folha o que a ponte do Trading 212 ainda lhe deve.
 *
 * Este lado e que escreve porque este lado e que conhece a pasta: o
 * BUDGET_FOLDER e um caminho do sistema de ficheiros do utilizador e o backend
 * corre num contentor. O backend fica com a contabilidade -- diz o que falta,
 * e regista o que a folha aceitou.
 *
 * Nao enfileira nada em PendingExpense, ao contrario do /api/expense. Nao
 * precisa: o servidor continua a dar a parcela como em divida enquanto nao for
 * marcada, portanto uma folha trancada resolve-se sozinha na proxima tentativa.
 * Enfileirar era arranjar uma segunda contabilidade da mesma divida, com o
 * risco de as duas escreverem o mesmo delta.
 */
export async function POST(request: Request) {
  const folder = budgetFolder();
  const empty: BridgeFlushResponse = { written: 0, skipped: 0, failures: [] };
  if (!folder) return NextResponse.json(empty);

  const cookie = request.headers.get("cookie") ?? "";

  return withFolderLock(async () => {
    const batches = groupEditsByYear(await fetchBridgePending(cookie));

    let written = 0;
    let skipped = 0;
    const failures: BridgeFlushResponse["failures"] = [];

    for (const batch of batches) {
      // Um ano trancado nao impede os outros: cada ano e o seu proprio ficheiro.
      let locked: boolean;
      try {
        locked = await isLocked(folder, batch.year);
      } catch (err) {
        // A ponte pode ter movimentos de um ano sem folha na pasta. Isolamos
        // esse ano e deixamos os outros seguir, como o flush dos pendentes.
        if (err instanceof SheetMissingError) {
          skipped += batch.edits.length;
          failures.push({
            year: batch.year,
            reason: `there is no sheet for ${batch.year} in the budget folder`,
          });
          continue;
        }
        throw err;
      }

      if (locked) {
        skipped += batch.edits.length;
        // Excel aberto e o caso normal e nao merece aviso -- resolve-se
        // sozinho. Qualquer outro bloqueio (so-de-leitura, ACL, antivirus)
        // nunca se resolve sozinho e tem de ser dito.
        if (!(await isExcelLock(folder, batch.year))) {
          failures.push({
            year: batch.year,
            reason: `the sheet for ${batch.year} could not be opened, and Excel does not appear to have it open`,
          });
        }
        continue;
      }

      try {
        const file = await readYear(folder, batch.year);
        const updated = await applyExpenses(file, batch.expenses);
        const result = await writeYear(folder, batch.year, updated, cookie);

        // "=== false" e nao "!result.ok": sem strictNullChecks (tsconfig deste
        // projecto), a negacao nao estreita a uniao discriminada.
        if (result.ok === false) {
          // alreadyWritten quer dizer que a folha ficou com as parcelas mas o
          // import recusou e a reposicao do backup tambem falhou. Marcar e o
          // que evita escreve-las outra vez na proxima corrida -- e o oposto
          // do caso normal, em que nao marcar e o que salva.
          if (result.alreadyWritten) {
            await markBridgeWritten(cookie, batch.written);
            written += batch.edits.length;
          } else {
            skipped += batch.edits.length;
          }
          failures.push({ year: batch.year, reason: result.reason });
          continue;
        }

        // So depois de o import aceitar. Marcar antes dava a divida por saldada
        // com a folha reposta ao estado anterior, e as parcelas desapareciam.
        if (!(await markBridgeWritten(cookie, batch.written))) {
          // A folha ficou escrita e o servidor nao soube. Nao ha nada a
          // desfazer -- a proxima corrida vai propor os mesmos deltas, o que
          // duplicaria. Dizer isto e o unico remedio honesto.
          failures.push({
            year: batch.year,
            reason: `the sheet for ${batch.year} was updated but the server could not record it — the next sync would write these amounts again`,
          });
        }
        written += batch.edits.length;
      } catch (err) {
        skipped += batch.edits.length;
        // A falha mais provavel de todas, e a unica que o utilizador consegue
        // resolver: a ponte escreve em "Trading 212", "Dividends" e "Interest",
        // e uma folha que nunca teve investimentos nao tem essas linhas. O
        // applyExpenses localiza tudo antes de escrever, portanto nada ficou
        // meio escrito -- so falta dizer que linha criar.
        if (err instanceof SheetTargetError && err.missing) {
          const { section, group, name } = err.missing;
          const where = group === "" ? section : `${section} › ${group}`;
          failures.push({
            year: batch.year,
            reason: `the sheet for ${batch.year} has no "${name}" row under ${where} — add it and the broker amounts will be written on the next sync`,
          });
          continue;
        }
        failures.push({
          year: batch.year,
          reason: `the sheet for ${batch.year} could not be updated`,
        });
      }
    }

    return NextResponse.json({ written, skipped, failures } satisfies BridgeFlushResponse);
  });
}
