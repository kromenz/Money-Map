/**
 * Reescrita cirurgica do XML de uma folha.
 *
 * Nao se usa ExcelJS: ele nao suporta graficos e deita fora os dois que a folha
 * tem ao regravar. Aqui mexe-se so nas celulas pedidas e o resto do documento
 * sai como entrou.
 */

/** O XML nao tem a forma que esta reescrita sabe tratar. */
export class SheetWriteError extends Error {}

export type Edit = {
  /** Ex.: "H26". */
  ref: string;
  delta: number;
  /**
   * `formula` -- celula de categoria: a formula cresce e o valor acompanha.
   * `value`   -- linha de subtotal: so o valor em cache, a formula fica intacta.
   */
  mode: "formula" | "value";
};

function splitRef(ref: string): { column: string; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new SheetWriteError(`Referencia invalida: ${ref}`);
  return { column: m[1], row: Number(m[2]) };
}

/** Ordem das colunas: primeiro pelo comprimento, depois alfabetica (Z < AA). */
function columnBefore(a: string, b: string): boolean {
  if (a.length !== b.length) return a.length < b.length;
  return a < b;
}

function rowPattern(row: number): RegExp {
  // "[\s\S]" em vez de "." com a flag "s" (dotAll): essa flag exige o target
  // es2018+ no tsconfig, e o resto da app compila para es2017. "[\s\S]"
  // atravessa linhas sem precisar da flag e tem exactamente o mesmo efeito.
  return new RegExp(`<row[^>]*\\br="${row}"[^>]*>[\\s\\S]*?</row>`);
}

function cellPattern(ref: string): RegExp {
  // O quantificador antes da alternativa tem de ser preguicoso: se for guloso,
  // engole o "/" de um "<c .../>" e a alternativa "/>" nunca chega a ser
  // tentada, caindo na alternativa ">...</c>", que entao avanca ate ao "</c>"
  // da celula seguinte na linha. "[\s\S]" substitui "." com a flag "s" pela
  // mesma razao que em rowPattern acima.
  return new RegExp(`<c[^>]*\\br="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
}

/** O valor em cache, ou 0 quando a celula nao tem nenhum. */
function cachedValue(cell: string): number {
  const m = /<v>([^<]*)<\/v>/.exec(cell);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Mata o ruido da virgula flutuante sem tocar em precisao real.
 *
 * 4.7+114.93+12.5 da 132.13000000000002 em binario. Dez casas chegam para o
 * ruido desaparecer e sao muito mais do que qualquer valor real desta folha usa.
 */
function clean(value: number): number {
  return Number(value.toFixed(10));
}

function withValue(cell: string, value: number): string {
  const text = String(clean(value));
  if (/<v>[^<]*<\/v>/.test(cell)) {
    return cell.replace(/<v>[^<]*<\/v>/, `<v>${text}</v>`);
  }
  // Sem <v>: acrescenta-o antes do fecho.
  return cell.replace(/<\/c>$/, `<v>${text}</v></c>`);
}

/** O estilo de qualquer outra celula da mesma linha, para uma celula nova herdar. */
function neighbourStyle(row: string): string {
  const m = /<c[^>]*\bs="(\d+)"/.exec(row);
  return m ? ` s="${m[1]}"` : "";
}

/** A etiqueta de abertura, sempre em forma aberta mesmo se a celula era `<c ... />`. */
function openTag(cell: string): string {
  const m = /^<c[^>]*?\/?>/.exec(cell);
  if (!m) throw new SheetWriteError(`Celula com forma inesperada: ${cell.slice(0, 40)}`);
  return m[0].endsWith("/>") ? `${m[0].slice(0, -2)}>` : m[0];
}

/**
 * Reconstroi a celula como `<c ...><f>expressao</f><v>valor</v></c>`.
 *
 * Reconstruir em vez de remendar: o `<f>` tem de vir antes do `<v>`, e os tres
 * casos -- com formula, so com valor, e vazia -- convergem todos nesta forma.
 */
function editFormulaCell(cell: string, delta: number): string {
  if (/<f[^>]*\bt="shared"/.test(cell)) {
    throw new SheetWriteError(
      "Celula com formula partilhada: nao e uma celula de categoria"
    );
  }

  const current = cachedValue(cell);
  const formula = /<f[^>]*>([^<]*)<\/f>/.exec(cell);
  const hasValue = /<v>[^<]*<\/v>/.test(cell);

  // Anexar a uma expressao aritmetica completa e sempre correcto, incluindo
  // -(a+b): o menos unario aplica-se ao grupo entre parenteses e nao ao que vem
  // a seguir.
  const body = formula
    ? `${formula[1]}+${delta}`
    : hasValue
      ? `${String(clean(current))}+${delta}`
      : String(delta);

  return `${openTag(cell)}<f>${body}</f><v>${clean(current + delta)}</v></c>`;
}

function insertCell(row: string, ref: string): string {
  const { column } = splitRef(ref);
  const style = neighbourStyle(row);
  const fresh = `<c r="${ref}"${style}/>`;

  // Mesmo cuidado que em cellPattern: quantificador preguicoso antes da
  // alternativa, para uma celula "<c .../>" nao ser engolida ate ao "</c>" da
  // celula seguinte. "[\s\S]" em vez de "." com a flag "s": essa flag exige
  // target es2018+, e o resto da app compila para es2017.
  const cells = [...row.matchAll(/<c[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)];
  const after = cells.find((m) => columnBefore(column, m[1]));

  if (after) {
    // Funcao de substituicao, nao string: after[0] vem do XML da folha e pode
    // conter formulas com "$" (ex.: SUM($C$21:$C$28)), que numa string de
    // substituicao seriam lidas como padroes especiais ($&, $1, ...) e
    // corromperiam o XML.
    return row.replace(after[0], () => `${fresh}${after[0]}`);
  }
  return row.replace(/<\/row>$/, `${fresh}</row>`);
}

/**
 * Aplica todas as edicoes ao XML da folha.
 *
 * Uma edicao `value` sobre uma celula que nao existe e ignorada de proposito: o
 * parser salta os meses sem valor em cache, portanto esse subtotal nao e
 * comparado e nao ha nada a corrigir. Uma edicao `formula` sobre uma celula que
 * nao existe cria-a; sobre uma linha que nao existe, e erro.
 */
export function applyEdits(sheetXml: string, edits: Edit[]): string {
  let xml = sheetXml;

  for (const edit of edits) {
    const { row } = splitRef(edit.ref);

    const rowMatch = rowPattern(row).exec(xml);
    if (!rowMatch) {
      if (edit.mode === "value") continue;
      throw new SheetWriteError(`A folha nao tem a linha ${row}`);
    }

    let rowXml = rowMatch[0];
    let cellMatch = cellPattern(edit.ref).exec(rowXml);

    if (!cellMatch) {
      if (edit.mode === "value") continue;
      rowXml = insertCell(rowXml, edit.ref);
      cellMatch = cellPattern(edit.ref).exec(rowXml);
      if (!cellMatch) throw new SheetWriteError(`Nao consegui criar ${edit.ref}`);
    }

    const cell = cellMatch[0];
    const updated =
      edit.mode === "formula"
        ? editFormulaCell(cell, edit.delta)
        : withValue(cell, cachedValue(cell) + edit.delta);

    // Funcao de substituicao, nao string: "cell" e "updated" podem conter
    // formulas com "$" (referencias absolutas como SUM($C$21:$C$28)). Numa
    // string de substituicao, "$&", "$1", "$`" e "$'" tem significado especial
    // e corromperiam o XML em silencio.
    xml = xml.replace(rowMatch[0], () => rowXml.replace(cell, () => updated));
  }

  return xml;
}
