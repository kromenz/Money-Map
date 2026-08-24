import { NextResponse } from "next/server";
import { applyExpenses } from "@/lib/xlsx-package";
import { groupPendingByYear } from "@/lib/pending-plan";
import {
  budgetFolder,
  isLocked,
  readYear,
  SheetMissingError,
  withFolderLock,
  writeYear,
} from "@/server/budget-file";
import type { FlushResponse, PendingExpense } from "@/types/expense";

export const runtime = "nodejs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

async function fetchPending(cookie: string): Promise<PendingExpense[]> {
  const res = await fetch(`${API_BASE}/budget/pending`, { headers: { cookie } });
  if (!res.ok) return [];
  const data = (await res.json()) as { pending: PendingExpense[] };
  return data.pending;
}

async function clear(cookie: string, ids: string[]): Promise<void> {
  await fetch(`${API_BASE}/budget/pending/clear`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => undefined);
}

export async function POST(request: Request) {
  const folder = budgetFolder();
  const empty: FlushResponse = { applied: 0, stillPending: 0, failures: [] };
  if (!folder) return NextResponse.json(empty);

  const cookie = request.headers.get("cookie") ?? "";

  return withFolderLock(async () => {
    const batches = groupPendingByYear(await fetchPending(cookie));

    let applied = 0;
    let stillPending = 0;
    const failures: FlushResponse["failures"] = [];

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
        continue;
      }

      try {
        const file = await readYear(folder, batch.year);
        const written = await applyExpenses(file, batch.expenses);
        const result = await writeYear(folder, batch.year, written, cookie);

        // "=== false" e nao "!result.ok": sem strictNullChecks (tsconfig
        // deste projecto), a negacao nao estreita a uniao discriminada e o
        // tsc reclama que "reason" nao existe.
        if (result.ok === false) {
          stillPending += batch.ids.length;
          failures.push({ year: batch.year, reason: result.reason });
          continue;
        }

        // So depois de o import aceitar. Limpar antes perdia os gastos se o
        // import revertesse.
        await clear(cookie, batch.ids);
        applied += batch.ids.length;
      } catch {
        stillPending += batch.ids.length;
        failures.push({
          year: batch.year,
          reason: `the sheet for ${batch.year} could not be updated`,
        });
      }
    }

    return NextResponse.json({ applied, stillPending, failures } satisfies FlushResponse);
  });
}
