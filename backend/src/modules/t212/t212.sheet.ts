import { Prisma } from "@prisma/client";
import { toDisplay } from "../budget/budget.grid";
import type { BridgeSection } from "./t212.bridge";

/**
 * Uma linha da ponte tal como esta gravada, com o que dela ja foi parar a
 * folha.
 */
export type StoredBridgeRow = {
  externalId: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Na convencao de armazenamento do Transaction. */
  amount: string;
  /** Na mesma convencao; null quer dizer que a folha ainda nao tem nada. */
  sheetAmount: string | null;
  section: BridgeSection;
  group: string;
  name: string;
  merchant: string;
};

/**
 * O que falta escrever numa celula da folha.
 *
 * `delta` vem na convencao da FOLHA e nao na do Transaction -- e o numero que
 * vai ser somado a celula, portanto tem de ter o sinal que o utilizador ve.
 */
export type SheetEdit = {
  externalId: string;
  year: number;
  month: number;
  section: BridgeSection;
  group: string;
  name: string;
  delta: string;
  /** Etiqueta a acompanhar este valor dentro da formula. */
  note: string;
  /**
   * O valor total da linha, na convencao de armazenamento. E o que volta ao
   * servidor como "escrito" depois de a folha aceitar -- e nao o delta, para
   * que uma marcacao perdida a meio nao deixe a conta a meio caminho.
   */
  amount: string;
};

const ZERO = new Prisma.Decimal(0);

/**
 * As linhas da ponte que ainda nao estao inteiras na folha.
 *
 * A folha soma por incrementos (o sheet-write acrescenta `+delta` a formula da
 * celula), portanto o que se escreve e sempre a diferenca entre o que a linha
 * vale e o que dela ja la esta. Numa linha nova isso e o valor todo; no
 * agregado mensal dos juros, que cresce enquanto o mes corre, e so o que
 * cresceu desde a ultima escrita.
 *
 * Uma diferenca de zero nao produz edicao nenhuma: escrever "+0" na formula
 * sujava-a para sempre sem mudar nada.
 */
export function sheetEdits(rows: StoredBridgeRow[]): SheetEdit[] {
  const edits: SheetEdit[] = [];

  for (const row of rows) {
    const amount = new Prisma.Decimal(row.amount);
    const written = row.sheetAmount === null ? ZERO : new Prisma.Decimal(row.sheetAmount);
    const missing = amount.sub(written);
    if (missing.isZero()) continue;

    edits.push({
      externalId: row.externalId,
      year: Number(row.date.slice(0, 4)),
      month: Number(row.date.slice(5, 7)),
      section: row.section,
      group: row.group,
      name: row.name,
      delta: toDisplay(row.section, missing).toFixed(2),
      note: noteFor(row),
      amount: amount.toFixed(2),
    });
  }

  return edits;
}

/**
 * O rotulo que fica ao lado do valor na formula da celula.
 *
 * Sem isto a folha ganhava numeros anonimos: uma celula com `=12,5+1,31+0,46`
 * nao diz qual daqueles veio de que dividendo. Com o rotulo, cada parcela
 * identifica-se sozinha ao clicar na celula.
 *
 * O merchant e o ticker nos dividendos e "Trading 212" no resto, que ja e a
 * distincao util; o dia desempata duas parcelas do mesmo tipo no mesmo mes.
 */
function noteFor(row: StoredBridgeRow): string {
  if (row.externalId.includes(":interest:")) {
    return `T212 juros ${row.date.slice(0, 7)}`;
  }
  return `${row.merchant} ${row.date}`;
}
