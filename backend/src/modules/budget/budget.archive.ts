/**
 * Que categorias e que deixaram de existir na folha.
 *
 * A importacao so sabia criar categorias, nunca tirar nenhuma. Uma folha
 * reimportada depois de o parser mudar de ideias sobre o que e um grupo deixava
 * as antigas para tras, e elas ficavam para sempre na grelha e na lista de
 * escolha -- foi assim que apareceram grupos como "Car Payments" ou
 * "Prescriptions", que sao categorias e nunca foram grupos.
 *
 * Arquiva-se, nao se apaga: o modelo tem a coluna `archived` e o buildGrid ja a
 * filtra. Apagar levava as transaccoes atras pelo onDelete em cascata.
 */

export type CategoryKey = { section: string; group: string; name: string };

export const categoryKeyOf = (c: CategoryKey) =>
  JSON.stringify([c.section, c.group, c.name]);

export type ArchivePlan = {
  toArchive: string[];
  /** Uma categoria que volte a aparecer na folha volta a estar activa. */
  toRestore: string[];
};

/**
 * O plano, dado o que esta em base e o que a folha traz.
 *
 * Duas condicoes para arquivar, e as duas sao precisas:
 *
 *  - Nao estar na folha que se acabou de importar.
 *  - Nao ter transaccao nenhuma, de ano nenhum.
 *
 * A segunda existe porque a importacao e por ano. Uma categoria que so aparece
 * na folha de 2025 esta legitimamente ausente da de 2026, e arquiva-la ao
 * importar 2026 escondia um ano inteiro de historico do utilizador. Sem
 * transaccoes nenhumas, porem, nao ha historico nenhum a esconder -- e
 * exactamente essa a assinatura das categorias que nasceram de uma leitura
 * errada e nunca chegaram a ser usadas.
 */
export function planArchive(
  existing: { id: string; section: string; group: string; name: string; archived: boolean }[],
  sheet: CategoryKey[],
  idsWithTransactions: Set<string>
): ArchivePlan {
  const inSheet = new Set(sheet.map(categoryKeyOf));

  const toArchive: string[] = [];
  const toRestore: string[] = [];

  for (const c of existing) {
    const here = inSheet.has(categoryKeyOf(c));

    if (here) {
      if (c.archived) toRestore.push(c.id);
      continue;
    }

    if (!c.archived && !idsWithTransactions.has(c.id)) toArchive.push(c.id);
  }

  return { toArchive, toRestore };
}
