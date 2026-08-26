import { prisma } from "../../db/prisma";
import { toDisplay } from "./budget.grid";

export type ParcelView = {
  seq: number;
  /** Na convencao da folha -- o numero que o utilizador ve na celula. */
  amount: string;
  note: string | null;
};

export type CategoryParcels = {
  categoryId: string;
  section: string;
  group: string;
  name: string;
  /** Na convencao da folha; a soma das parcelas. */
  total: string;
  parcels: ParcelView[];
};

/**
 * O que foi comprado num mes, por categoria.
 *
 * Devolve tudo na convencao da folha, tal como a grelha: quem le nunca tem de
 * saber que `savings` e `expenses` estao gravados com o sinal trocado.
 *
 * Uma categoria sem parcelas legiveis simplesmente nao aparece -- e o caso das
 * celulas cuja formula nao e uma soma simples, e a grelha continua a mostrar o
 * total delas na mesma.
 */
export async function getMonthParcels(
  userId: string,
  year: number,
  month: number
): Promise<{ year: number; month: number; categories: CategoryParcels[] }> {
  const rows = await prisma.sheetParcel.findMany({
    where: { userId, year, month },
    select: {
      seq: true,
      amount: true,
      note: true,
      categoryId: true,
      category: { select: { section: true, group: true, name: true, sortOrder: true } },
    },
    orderBy: [{ categoryId: "asc" }, { seq: "asc" }],
  });

  const byCategory = new Map<string, CategoryParcels & { sortOrder: number }>();

  for (const row of rows) {
    // O zero que a escrita deixa numa celula que estava vazia nao e uma compra.
    // Conta para a soma (vale zero) mas nao tem nada para mostrar, e uma linha
    // "0,00 --" no meio da lista so confundia.
    if (row.amount.isZero() && row.note === null) continue;

    let entry = byCategory.get(row.categoryId);
    if (!entry) {
      entry = {
        categoryId: row.categoryId,
        section: row.category.section,
        group: row.category.group,
        name: row.category.name,
        total: "0.00",
        parcels: [],
        sortOrder: row.category.sortOrder,
      };
      byCategory.set(row.categoryId, entry);
    }

    const shown = toDisplay(row.category.section, row.amount);
    entry.parcels.push({
      seq: row.seq,
      amount: shown.toFixed(2),
      note: row.note,
    });
    entry.total = shown.add(entry.total).toFixed(2);
  }

  const categories = [...byCategory.values()]
    // Pela ordem da folha dentro de cada seccao, que e a ordem por que o
    // utilizador esta habituado a olhar para ela.
    .sort((a, b) =>
      a.section === b.section ? a.sortOrder - b.sortOrder : a.section.localeCompare(b.section)
    )
    .map(({ sortOrder: _sortOrder, ...rest }) => rest);

  return { year, month, categories };
}
