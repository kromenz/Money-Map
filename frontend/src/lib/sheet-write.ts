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
  /**
   * Etiqueta a acompanhar esta parcela dentro da formula, em modo `formula`.
   *
   * Sem ela a celula fica com numeros anonimos: `=12,5+1,31+499,99` nao diz
   * qual daqueles foi a PS5 e qual foi o dividendo. Vai logo a seguir ao valor
   * que descreve, como `N("PS5")` -- o N() de texto vale zero em Excel e em
   * LibreOffice, portanto a soma da celula nao muda.
   *
   * Ignorada em modo `value`: essa so mexe no valor em cache de um subtotal e
   * nao tem formula onde a escrever.
   */
  note?: string;
};

/**
 * Texto para dentro de uma string de formula, ja seguro para o XML.
 *
 * Duas escapagens sobrepostas, e as duas sao precisas: as aspas duplicam-se
 * porque e assim que uma string de Excel as leva, e o &<> escapam-se porque o
 * <f> e um no de texto XML. Uma nota com um & partia o zip inteiro.
 */
function quoteNote(note: string): string {
  const escaped = note
    .replace(/"/g, '""')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `N("${escaped}")`;
}

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

/**
 * A celula tem t="s" (shared string), t="str" (formula com resultado texto)
 * ou t="inlineStr" (texto embutido)?
 *
 * Nestes tres casos o conteudo de <v> nao e um numero: em t="s" e um indice
 * para xl/sharedStrings.xml, nao um montante. A folha usa "-" como marcador
 * de mes sem movimento em varias categorias, guardado assim.
 */
function isTextCell(cell: string): boolean {
  return /<c[^>]*\bt="(?:s|str|inlineStr)"/.test(cell);
}

/** O valor em cache, ou 0 quando a celula nao tem nenhum ou e uma celula de texto. */
function cachedValue(cell: string): number {
  if (isTextCell(cell)) return 0;
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

/**
 * Escrever um numero em <v> sobre uma etiqueta ainda marcada t="s"/"str"/
 * "inlineStr" transforma esse numero num indice de shared string aos olhos de
 * qualquer leitor -- o t mentiria sobre o que o <v> novo significa. Aplica-se
 * tambem a uma linha de subtotal: locateCells devolve a mesma linha para
 * todos os meses assim que qualquer mes tiver numero, por isso um subtotal
 * numerico na maioria dos meses mas com o marcador "-" nalgum mes especifico
 * passa por aqui em modo valor.
 */
function stripTextType(cell: string): string {
  return isTextCell(cell) ? cell.replace(/\s+t="(?:s|str|inlineStr)"/, "") : cell;
}

function withValue(cell: string, value: number): string {
  const text = String(clean(value));
  const untyped = stripTextType(cell);
  if (/<v>[^<]*<\/v>/.test(untyped)) {
    return untyped.replace(/<v>[^<]*<\/v>/, `<v>${text}</v>`);
  }
  // Sem <v>: acrescenta-o antes do fecho.
  return untyped.replace(/<\/c>$/, `<v>${text}</v></c>`);
}

/** O estilo de qualquer outra celula da mesma linha, para uma celula nova herdar. */
function neighbourStyle(row: string): string {
  const m = /<c[^>]*\bs="(\d+)"/.exec(row);
  return m ? ` s="${m[1]}"` : "";
}

/**
 * A etiqueta de abertura, sempre em forma aberta mesmo se a celula era
 * `<c ... />`, e sem o atributo `t`.
 *
 * O `t` (tipo da celula: "s" indice de shared string, "str" resultado texto
 * de formula, "inlineStr" texto embutido, ou ausente para numero) descreve o
 * conteudo antigo de `<v>`. Depois desta funcao a celula passa a ter uma
 * formula numerica com um `<v>` numerico -- manter um `t` de texto faria um
 * leitor interpretar esse `<v>` novo como indice de shared string outra vez.
 */
function openTag(cell: string): string {
  const m = /^<c[^>]*?\/?>/.exec(cell);
  if (!m) throw new SheetWriteError(`Celula com forma inesperada: ${cell.slice(0, 40)}`);
  const open = m[0].endsWith("/>") ? `${m[0].slice(0, -2)}>` : m[0];
  return open.replace(/\s+t="[^"]*"/, "");
}

/**
 * Reconstroi a celula como `<c ...><f>expressao</f><v>valor</v></c>`.
 *
 * Reconstruir em vez de remendar: o `<f>` tem de vir antes do `<v>`, e os tres
 * casos -- com formula, so com valor, e vazia -- convergem todos nesta forma.
 */
function editFormulaCell(cell: string, delta: number, note?: string): string {
  if (/<f[^>]*\bt="shared"/.test(cell)) {
    throw new SheetWriteError(
      "Celula com formula partilhada: nao e uma celula de categoria"
    );
  }

  // Uma celula de texto (t="s"/"str"/"inlineStr") nao tem formula nem valor
  // aritmetico para aproveitar, mesmo que tenha um <v> -- esse <v> e um
  // indice de shared string (ex.: o marcador "-" usado nos meses sem
  // movimento), nao um montante. Trata-se como vazia: a edicao comeca do
  // zero, tal como uma celula sem <f> nem <v>.
  const textCell = isTextCell(cell);
  const current = cachedValue(cell);
  const formula = !textCell ? /<f[^>]*>([^<]*)<\/f>/.exec(cell) : null;
  const hasValue = !textCell && /<v>[^<]*<\/v>/.test(cell);

  // Anexar a uma expressao aritmetica completa e sempre correcto, incluindo
  // -(a+b): o menos unario aplica-se ao grupo entre parenteses e nao ao que vem
  // a seguir.
  // A etiqueta vem LOGO A SEGUIR ao valor que descreve, e nao no fim da
  // formula: le-se "valor, e o que ele foi", e cada N() fica colado ao numero
  // a que pertence quando a celula tem varias parcelas.
  const parcel = note ? `${delta}+${quoteNote(note)}` : String(delta);

  const body = formula
    ? `${formula[1]}+${parcel}`
    : hasValue
      ? `${String(clean(current))}+${parcel}`
      : parcel;

  // O valor em cache ignora a etiqueta de proposito: N() de texto vale zero,
  // portanto a soma da celula e a mesma com ela ou sem ela.
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
        ? editFormulaCell(cell, edit.delta, edit.note)
        : withValue(cell, cachedValue(cell) + edit.delta);

    // Funcao de substituicao, nao string: "cell" e "updated" podem conter
    // formulas com "$" (referencias absolutas como SUM($C$21:$C$28)). Numa
    // string de substituicao, "$&", "$1", "$`" e "$'" tem significado especial
    // e corromperiam o XML em silencio.
    xml = xml.replace(rowMatch[0], () => rowXml.replace(cell, () => updated));
  }

  return xml;
}
