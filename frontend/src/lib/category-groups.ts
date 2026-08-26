import type { GridRow } from "@/types/budget";

export type CategoryGroup = {
  group: string;
  items: { value: string; label: string }[];
};

/**
 * As categorias agrupadas para a lista de escolha, pela ordem da primeira
 * aparicao de cada grupo.
 *
 * Nao se pode assumir que as categorias chegam com os grupos todos seguidos.
 * A grelha ordena por sortOrder, e basta uma categoria de outro grupo pelo meio
 * para o mesmo grupo aparecer em dois trocos -- as que sobraram de importacoes
 * antigas intercalam-se exactamente assim. Abrir um bloco novo sempre que o
 * grupo muda em relacao a linha anterior dava dois blocos com a mesma chave, e
 * o React recusava com "two children with the same key".
 */
export function groupCategories(rows: GridRow[]): CategoryGroup[] {
  const byGroup = new Map<string, CategoryGroup["items"]>();

  for (const row of rows) {
    const item = { value: row.categoryId, label: row.name };
    const items = byGroup.get(row.group);
    if (items) items.push(item);
    else byGroup.set(row.group, [item]);
  }

  return [...byGroup.entries()].map(([group, items]) => ({ group, items }));
}
