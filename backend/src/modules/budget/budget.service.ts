import { Prisma, Section, TxSource } from "@prisma/client";
import { prisma } from "../../db/prisma";
import {
  parseBudgetWorkbook,
  signedAmount,
  type ParsedWorkbook,
} from "./budget.parser";
import { compareScope } from "./budget.verify";
import type { MonthComparison, StructureReport } from "./budget.verify";
import { diffCells, type DiffCell, type WorkbookDiff } from "./budget.diff";
import { toDisplay } from "./budget.grid";
import { runBridge } from "../t212/t212.bridge";
import { loadT212Config } from "../t212/t212.config";
import { prismaRepo } from "../t212/t212.repo";

export type ImportResult = {
  year: number;
  categoriesCreated: number;
  transactionsWritten: number;
  comparisons: MonthComparison[];
  structure: StructureReport;
  allMatch: boolean;
};

/**
 * O Prisma so reverte a transacao se o callback lancar, e lancar descarta o
 * valor de retorno. Como precisamos do relatorio E do rollback, o relatorio
 * viaja dentro do erro. Nao e um erro a serio -- e a unica forma de ter as duas
 * coisas sem gravar dados que sabemos estarem errados.
 */
class ImportMismatch extends Error {
  constructor(readonly result: ImportResult) {
    super("A estrutura importada nao reproduz a folha");
  }
}

/**
 * Dia 1 do mes, meio-dia UTC. Dia 1 porque o ultimo dia de um mes em curso
 * estaria no futuro; meio-dia porque protege contra qualquer deslocacao de
 * fuso atirar a data para o mes anterior.
 */
export function monthDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

export function externalIdFor(
  year: number,
  month: number,
  c: { section: string; group: string; name: string }
): string {
  const mm = String(month).padStart(2, "0");
  return `excel:${year}-${mm}:${c.section}/${c.group}/${c.name}`;
}

function categoryKey(c: {
  section: string;
  group: string;
  name: string;
}): string {
  return `${c.section}/${c.group}/${c.name}`;
}

export async function importBudgetWorkbook(
  userId: string,
  buffer: Buffer,
  year: number
): Promise<ImportResult> {
  const parsed = await parseBudgetWorkbook(buffer, year);

  let result: ImportResult;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const written = await writeAndVerify(tx, userId, parsed, year);
        if (!written.allMatch) throw new ImportMismatch(written);
        return written;
      },
      // Por omissao o Prisma corta aos 5s. O import faz poucas queries mas
      // algumas mexem em centenas de linhas.
      { timeout: 30_000, maxWait: 10_000 }
    );
  } catch (err) {
    // A importacao reverteu: o corte nao mudou, e nao ha nada a reconciliar.
    if (err instanceof ImportMismatch) return err.result;
    throw err;
  }

  await reconcileBridgeAfterImport(userId);
  return result;
}

/**
 * O corte da ponte deriva do ultimo mes com transacoes vindas do Excel, e quem
 * faz esse maximo avancar e precisamente esta importacao -- mas a reconciliacao
 * so corria dentro do syncAll.
 *
 * Sem isto, no instante em que a folha passa a cobrir Outubro a grelha de
 * Outubro mostra a transferencia da folha E o deposito que a ponte criou antes:
 * a poupanca do mes fica inflacionada ate a proxima sincronizacao, que pode ser
 * so quando a pessoa voltar a abrir a app.
 *
 * E tudo leitura e escrita local, sem rede. Uma falha aqui nao pode reverter
 * nem partir a importacao, que ja esta confirmada e verificada ao centimo -- e
 * por isso que o erro so se regista: o pior caso passa a ser o comportamento
 * que havia antes, com a proxima sincronizacao a reconciliar.
 */
async function reconcileBridgeAfterImport(userId: string): Promise<void> {
  try {
    await runBridge(userId, prismaRepo, loadT212Config().bridgeFrom);
  } catch (err) {
    console.error(
      "[budget] import feito, mas a reconciliacao da ponte T212 falhou",
      err
    );
  }
}

async function writeAndVerify(
  // Prisma.TransactionClient e o tipo publico do cliente dentro de uma
  // transacao. Nao derivar de typeof prisma.$transaction: e uma funcao com
  // sobrecargas e a inferencia apanha a versao de array, nao a de callback.
  tx: Prisma.TransactionClient,
  userId: string,
  parsed: ParsedWorkbook,
  year: number
): Promise<ImportResult> {
  // 1. Categorias: uma leitura e uma escrita, em vez de uma query por categoria.
  const before = await tx.category.findMany({ where: { userId } });
  const categoryIds = new Map<string, string>();
  for (const c of before) categoryIds.set(categoryKey(c), c.id);

  const missing = parsed.categories.filter((c) => !categoryIds.has(categoryKey(c)));
  if (missing.length > 0) {
    await tx.category.createMany({
      data: missing.map((c) => ({
        userId,
        name: c.name,
        section: c.section as Section,
        group: c.group,
        sortOrder: c.sortOrder,
      })),
    });
    const after = await tx.category.findMany({ where: { userId } });
    for (const c of after) categoryIds.set(categoryKey(c), c.id);
  }

  // 2. Transacoes: apagar o ambito e reescrever.
  //
  // O upsert por externalId nunca apagava nada, por isso uma linha removida da
  // folha ficava na base de dados para sempre. Apagar o ambito primeiro torna a
  // reimportacao um espelho da folha, e nao uma acumulacao.
  const from = monthDate(year, 1);
  const to = monthDate(year + 1, 1);

  await tx.transaction.deleteMany({
    where: { userId, source: TxSource.excel, date: { gte: from, lt: to } },
  });

  const rows = parsed.cells.flatMap((cell) => {
    const categoryId = categoryIds.get(categoryKey(cell));
    if (!categoryId) return [];
    return [
      {
        userId,
        date: monthDate(year, cell.month),
        amount: new Prisma.Decimal(
          signedAmount(cell.section, cell.sheetValue).toFixed(2)
        ),
        categoryId,
        source: TxSource.excel,
        externalId: externalIdFor(year, cell.month, cell),
        rawDescription: `Agregado mensal importado da folha ${year}`,
      },
    ];
  });

  if (rows.length > 0) await tx.transaction.createMany({ data: rows });

  // 3. Ler de volta o que ficou gravado e comparar com o que a folha declara.
  //    Dentro da transacao isto ve as escritas por confirmar, portanto continua
  //    a ser verificacao de ida-e-volta e nao uma comparacao em memoria.
  const written = await tx.transaction.findMany({
    where: { userId, source: TxSource.excel, date: { gte: from, lt: to } },
    select: {
      amount: true,
      date: true,
      category: { select: { section: true, group: true } },
    },
  });

  const sectionTotals = new Map<string, Prisma.Decimal[]>();
  const groupTotals = new Map<string, Prisma.Decimal[]>();
  const zeros = () => Array.from({ length: 12 }, () => new Prisma.Decimal(0));

  for (const t of written) {
    if (!t.category) continue;
    const month = t.date.getUTCMonth();
    // Desfaz a inversao de sinal, para comparar na convencao da folha.
    const value = toDisplay(t.category.section, t.amount);

    const sKey = t.category.section;
    if (!sectionTotals.has(sKey)) sectionTotals.set(sKey, zeros());
    sectionTotals.get(sKey)![month] = sectionTotals.get(sKey)![month].plus(value);

    const gKey = `${t.category.section}/${t.category.group}`;
    if (!groupTotals.has(gKey)) groupTotals.set(gKey, zeros());
    groupTotals.get(gKey)![month] = groupTotals.get(gKey)![month].plus(value);
  }

  const comparisons: MonthComparison[] = [];
  let made = 0;
  let skipped = 0;

  for (const section of ["income", "savings", "expenses"] as const) {
    const r = compareScope(
      section,
      parsed.checksums.sections[section].months,
      sectionTotals.get(section) ?? zeros()
    );
    comparisons.push(...r.rows);
    made += r.made;
    skipped += r.skipped;
  }

  for (const [key, declared] of Object.entries(parsed.checksums.groups)) {
    const r = compareScope(key, declared.months, groupTotals.get(key) ?? zeros());
    comparisons.push(...r.rows);
    made += r.made;
    skipped += r.skipped;
  }

  return {
    year,
    categoriesCreated: missing.length,
    transactionsWritten: rows.length,
    comparisons,
    structure: {
      sections: new Set(parsed.categories.map((c) => c.section)).size,
      groups: [
        ...new Set(
          parsed.categories
            .filter((c) => c.group !== "")
            .map((c) => `${c.section}/${c.group}`)
        ),
      ].sort(),
      categories: parsed.categories.length,
      comparisonsMade: made,
      comparisonsSkipped: skipped,
    },
    allMatch: comparisons.length > 0 && comparisons.every((c) => c.ok),
  };
}

export type PreviewResult = WorkbookDiff & { year: number };

/**
 * Le a folha e compara-a com o que esta gravado, sem escrever nada.
 *
 * Existe para a UI poder mostrar o que muda antes de substituir um ano. O
 * import continua a ser a operacao que decide -- este preview pode ficar
 * desactualizado entre o utilizador ver e confirmar, e nao faz mal: o import
 * corre na transacao com a verificacao estrutural e reverte sozinho se os
 * totais nao baterem.
 */
export async function previewBudgetWorkbook(
  userId: string,
  buffer: Buffer,
  year: number
): Promise<PreviewResult> {
  const parsed = await parseBudgetWorkbook(buffer, year);

  const stored = await prisma.transaction.findMany({
    where: {
      userId,
      source: TxSource.excel,
      date: { gte: monthDate(year, 1), lt: monthDate(year + 1, 1) },
    },
    select: {
      amount: true,
      date: true,
      category: { select: { section: true, group: true, name: true } },
    },
  });

  // So os de origem `excel`: sao os unicos que o import apaga e reescreve.
  // Movimentos manuais do mesmo ano sobrevivem e nao tem nada que ver no diff.
  const storedCells: DiffCell[] = stored.flatMap((t) => {
    if (!t.category) return [];
    return [
      {
        section: t.category.section,
        group: t.category.group,
        name: t.category.name,
        month: t.date.getUTCMonth() + 1,
        // Desfaz a inversao de sinal, para comparar na convencao da folha.
        value: toDisplay(t.category.section, t.amount),
      },
    ];
  });

  const sheetCells: DiffCell[] = parsed.cells.map((c) => ({
    section: c.section,
    group: c.group,
    name: c.name,
    month: c.month,
    value: new Prisma.Decimal(c.sheetValue.toFixed(2)),
  }));

  return { year, ...diffCells(sheetCells, storedCells) };
}
