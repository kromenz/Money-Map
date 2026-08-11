import type { GridRow } from "../types/budget";

export type RowGroup = { group: string; rows: GridRow[] };

/**
 * Junta as linhas da grelha por grupo, uma entrada por grupo distinto.
 *
 * Nao basta juntar corridas consecutivas. O sortOrder das categorias e um
 * indice por folha, atribuido uma so vez, quando a categoria e criada: importar
 * um segundo ano cria apenas as categorias que faltavam, e essas recebem
 * indices da numeracao dessa outra folha. As duas numeracoes entrelacam-se e as
 * linhas de um grupo deixam de vir seguidas -- o que dava duas entradas com o
 * mesmo nome, dois cabecalhos repetidos no ecra e duas chaves iguais no React.
 *
 * A ordem e a da primeira aparicao de cada grupo, para a grelha continuar a
 * parecer-se com a folha.
 */
export function groupRows(rows: GridRow[]): RowGroup[] {
  const out: RowGroup[] = [];
  const byGroup = new Map<string, RowGroup>();

  for (const row of rows) {
    const seen = byGroup.get(row.group);
    if (seen) {
      seen.rows.push(row);
      continue;
    }
    const created: RowGroup = { group: row.group, rows: [row] };
    byGroup.set(row.group, created);
    out.push(created);
  }

  return out;
}
