import { prisma } from "../../db/prisma";

export type YearWithData = {
  year: number;
  transactions: number;
};

type RawYearRow = {
  year: number;
  transactions: number | bigint;
};

/**
 * O count vem como bigint do Postgres mesmo com o cast, dependendo do driver, e
 * um BigInt rebenta o JSON.stringify do Express. Converter aqui e barato e
 * fecha a questao.
 */
export function normaliseYearRows(rows: RawYearRow[]): YearWithData[] {
  return rows
    .map((r) => ({ year: Number(r.year), transactions: Number(r.transactions) }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Que anos e que este utilizador tem movimentos.
 *
 * Conta todas as origens, nao so `excel`: o que interessa a quem navega e "este
 * ano tem alguma coisa para ver". Query raw porque o Prisma nao agrupa por
 * parte de data. O ano sai correcto porque as datas sao gravadas ao meio-dia
 * UTC, o que protege contra qualquer deslocacao de fuso atirar Janeiro para o
 * ano anterior.
 */
export async function listYears(userId: string): Promise<YearWithData[]> {
  const rows = await prisma.$queryRaw<RawYearRow[]>`
    SELECT EXTRACT(YEAR FROM "date")::int AS year,
           count(*)::int AS transactions
    FROM "Transaction"
    WHERE "userId" = ${userId}
    GROUP BY 1
    ORDER BY 1
  `;

  return normaliseYearRows(rows);
}
