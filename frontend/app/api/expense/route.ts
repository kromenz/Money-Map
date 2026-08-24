import { NextResponse } from "next/server";
import { applyExpenses } from "@/lib/xlsx-package";
import { SheetTargetError } from "@/lib/sheet-locate";
import {
  budgetFolder,
  countPending,
  isLocked,
  queuePending,
  readYear,
  SheetMissingError,
  withFolderLock,
  writeYear,
} from "@/server/budget-file";
import type { AddExpenseResponse, NewExpense } from "@/types/expense";

// Le e escreve no disco, por isso nao pode correr no runtime edge.
export const runtime = "nodejs";

type Body = NewExpense & { year: number };

function bad(reason: string, status = 400) {
  return NextResponse.json({ status: "error", reason } satisfies AddExpenseResponse, {
    status,
  });
}

export async function POST(request: Request) {
  const folder = budgetFolder();
  if (!folder) {
    return bad("expenses can only be added when a budget folder is configured");
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  // Duas casas: dinheiro. Arredonda-se antes de validar > 0, nao depois --
  // 0.004 passava as duas verificacoes com a ordem trocada e o "+0" ficava
  // escrito na formula da folha para sempre.
  const amount = body ? Number(Number(body.amount).toFixed(2)) : NaN;
  if (
    !body ||
    !Number.isInteger(body.year) ||
    !Number.isInteger(body.month) ||
    body.month < 1 ||
    body.month > 12 ||
    typeof body.name !== "string" ||
    body.name === "" ||
    !(amount > 0)
  ) {
    return bad("that expense is not valid");
  }

  const cookie = request.headers.get("cookie") ?? "";

  async function respondPending(): Promise<Response> {
    const queued = await queuePending(cookie, {
      year: body.year,
      month: body.month,
      section: body.section,
      group: body.group,
      name: body.name,
      amount: amount.toFixed(2),
    });
    if (!queued) return bad("could not save the expense as pending", 502);

    return NextResponse.json({
      status: "pending",
      year: body.year,
      count: await countPending(cookie),
    } satisfies AddExpenseResponse);
  }

  return withFolderLock(async () => {
    let locked: boolean;
    try {
      locked = await isLocked(folder, body.year);
    } catch (err) {
      // Sem folha para o ano, nao ha nada a bloquear nem a enfileirar --
      // enfileirar isto ficava pendente para sempre, porque a folha em falta
      // nunca ia passar a existir sozinha.
      if (err instanceof SheetMissingError) {
        return bad(`there is no sheet for ${body.year} in the budget folder`);
      }
      throw err;
    }

    if (locked) return respondPending();

    let written: Uint8Array;
    try {
      const file = await readYear(folder, body.year);
      written = await applyExpenses(file, [
        {
          section: body.section,
          group: body.group,
          name: body.name,
          month: body.month,
          amount,
        },
      ]);
    } catch (err) {
      if (err instanceof SheetTargetError) return bad("that category is not in the sheet");
      // O erro do fs traz o caminho absoluto embutido na mensagem. Nao pode
      // chegar ao browser -- a mesma regra que o folder-scan ja segue.
      return bad(`there is no readable sheet for ${body.year} in the budget folder`);
    }

    let result: { ok: true } | { ok: false; reason: string };
    try {
      result = await writeYear(folder, body.year, written, cookie);
    } catch {
      // O rename dentro de writeYear pode falhar com EPERM/EBUSY se o Excel
      // abrir o ficheiro na janela entre o isLocked la em cima e agora -- um
      // ExcelJS parse e um zip inteiro por reconstruir separam as duas
      // verificacoes. Sem isto o erro escapava do withFolderLock sem guarda
      // nenhuma: 500 opaco com o caminho absoluto la dentro em dev, e o gasto
      // perdido em vez de enfileirado. Em vez disso trata-se como o mesmo
      // caso do ficheiro trancado -- o gasto sobrevive como pendente.
      return respondPending();
    }
    // "=== false" e nao "!result.ok": sem strictNullChecks (tsconfig deste
    // projecto), a negacao nao estreita a uniao discriminada e o tsc reclama
    // que "reason" nao existe.
    if (result.ok === false) return bad(result.reason, 409);

    return NextResponse.json({
      status: "written",
      year: body.year,
    } satisfies AddExpenseResponse);
  });
}
