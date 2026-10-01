/**
 * Desmonta a formula de uma celula nas parcelas que a compoem.
 *
 * As celulas da folha ja sao somas de compras: `=42.88+11.39` sao duas coisas
 * compradas naquele mes, nao um valor unico. O que faltava era o nome de cada
 * uma, e e isso que as etiquetas `N("...")` acrescentam a partir de agora --
 * mas as parcelas sem nome tambem contam, porque dizem quantas compras houve e
 * de que valor, em todo o historico que ja existe.
 */

export type Parcel = {
  /** Na convencao da folha, tal como esta escrito na celula. */
  value: number;
  /** null quando a parcela nao tem etiqueta -- o caso de tudo o que ja la esta. */
  note: string | null;
};

/** Um numero sem sinal, com decimais opcionais. */
const NUMBER = /^\d+(?:\.\d+)?/;

/**
 * Uma etiqueta `N("...")`. O `(?:[^"]|"")*` e deliberadamente permissivo: o
 * que la esta dentro e texto do utilizador e nao se interpreta.
 *
 * O espaco e tolerado ENTRE as pecas mas nunca removido do texto todo de uma
 * vez -- as etiquetas tem espacos lá dentro ("AAPL_US_EQ 2026-09-15", "T212
 * juros 2026-09"), e limpa-los a monte transformava-as noutra coisa.
 */
const NOTE = /^N\(\s*"((?:[^"]|"")*)"\s*\)/;

type Token = { kind: "number"; value: number } | { kind: "note"; note: string };

/**
 * Le aritmetica so de numeros -- `2*3.29`, `(250+55+11.1)`, `-(106.66+78.58)`
 * -- a partir de `pos`. Devolve o valor e onde parou, ou null ao primeiro
 * caracter que nao seja numero, operador ou parentese: uma referencia a uma
 * celula, uma funcao ou uma etiqueta dentro de parenteses nao sao contas que
 * se possam fazer aqui.
 */
class Arithmetic {
  constructor(private readonly src: string, public pos: number) {}

  private skip(): void {
    while (this.src[this.pos] === " ") this.pos++;
  }

  /** Somas e subtracoes: so dentro de parenteses. */
  sum(): number | null {
    let acc = this.product();
    if (acc === null) return null;
    for (;;) {
      this.skip();
      const op = this.src[this.pos];
      if (op !== "+" && op !== "-") return acc;
      this.pos++;
      const next = this.product();
      if (next === null) return null;
      acc = op === "+" ? acc + next : acc - next;
    }
  }

  /** Um termo: factores ligados por `*` ou `/`. */
  product(): number | null {
    let acc = this.factor();
    if (acc === null) return null;
    for (;;) {
      this.skip();
      const op = this.src[this.pos];
      if (op !== "*" && op !== "/") return acc;
      this.pos++;
      const next = this.factor();
      if (next === null) return null;
      if (op === "/" && next === 0) return null;
      acc = op === "*" ? acc * next : acc / next;
    }
  }

  private factor(): number | null {
    this.skip();
    const c = this.src[this.pos];
    if (c === "-" || c === "+") {
      this.pos++;
      const v = this.factor();
      return v === null ? null : c === "-" ? -v : v;
    }
    if (c === "(") {
      this.pos++;
      const v = this.sum();
      this.skip();
      if (v === null || this.src[this.pos] !== ")") return null;
      this.pos++;
      return v;
    }
    const m = NUMBER.exec(this.src.slice(this.pos));
    if (!m) return null;
    this.pos += m[0].length;
    return Number(m[0]);
  }
}

/**
 * Os termos da formula pela ordem em que estao escritos, ou null quando ela
 * nao e uma soma de termos e etiquetas.
 *
 * Um termo e o que fica entre dois `+`/`-` de fora de parenteses, e vale uma
 * compra: `2*3.29` sao duas embalagens da mesma coisa e `(250+55+11.1)` sao
 * varias despesas que o utilizador juntou sob uma etiqueta so. Desmanchar o
 * grupo deixava as pecas sem nome e contrariava o agrupamento que ele fez.
 */
function tokenize(formula: string): Token[] | null {
  // O `=` inicial pode vir ou nao, conforme quem entrega a formula.
  const src = formula.trim().replace(/^=/, "").trim();
  if (src === "") return null;

  const tokens: Token[] = [];
  let pos = 0;

  for (;;) {
    while (src[pos] === " ") pos++;
    if (src.startsWith("N(", pos)) {
      const m = NOTE.exec(src.slice(pos));
      if (!m) return null;
      pos += m[0].length;
      // As aspas duplicadas voltam a ser uma so: e a escapagem que o
      // sheet-write aplicou ao escrever.
      tokens.push({ kind: "note", note: m[1].replace(/""/g, '"') });
    } else {
      const reader = new Arithmetic(src, pos);
      const value = reader.product();
      if (value === null || !Number.isFinite(value)) return null;
      pos = reader.pos;
      // Um termo composto traz o ruido binario da conta (3.79+5.98+... da
      // 57.400000000000006); a coluna guarda centimos, e e isso que se
      // compara com o valor da celula.
      tokens.push({ kind: "number", value: Math.round(value * 100) / 100 });
    }

    while (src[pos] === " ") pos++;
    if (pos === src.length) break;

    // Entre termos so pode vir o operador. Uma referencia a outra celula ou
    // um `)` a mais querem dizer que isto nao e uma soma que se leia.
    const op = src[pos];
    if (op !== "+" && op !== "-") return null;
    // O `-` fica para o termo seguinte ler como sinal; uma etiqueta so se
    // junta com `+`, e um `-N(` cai no Arithmetic e e recusado.
    if (op === "+") pos++;
    if (src.slice(pos).trim() === "") return null;
  }

  return tokens;
}

/**
 * As parcelas de uma formula, ou lista vazia quando ela nao e uma soma simples.
 *
 * Recusar e o comportamento certo para tudo o que nao seja uma sequencia de
 * numeros: um `SUM(C21:C28)` de subtotal ou um `-(A1+A2)` nao tem parcelas no
 * sentido que interessa aqui, e inventar uma leitura para eles daria uma lista
 * de compras que nunca existiu. Mais vale nao mostrar nada do que mostrar
 * errado -- e o mesmo criterio que o resto desta app usa com dinheiro.
 *
 * A etiqueta cola-se ao valor ao lado, e ha dois estilos. A mao escreve-se
 * a etiqueta ANTES do valor (`N("x")+3.74`) -- e o que a folha real tem,
 * incluindo celulas com valores sem nome pelo meio (`17+46+N("y")+52`, em que
 * o "y" e o 52). O sheet-write escreve DEPOIS (`+3.74+N("x")`), mas so no fim
 * da formula, porque acrescenta sempre ao fim. Dai a regra: os pares
 * valor+etiqueta que fecham a formula sao da barra; tudo o resto le-se no
 * estilo da mao. Uma etiqueta que nao tem valor a que se colar torna a
 * formula ilegivel -- nao se inventa a que valor pertencia.
 */
export function parseParcels(formula: string | null): Parcel[] {
  if (!formula) return [];

  const tokens = tokenize(formula);
  if (!tokens) return [];

  // A cauda que a barra escreveu: pares (valor, etiqueta) a contar do fim.
  let head = tokens.length;
  while (
    head >= 2 &&
    tokens[head - 1].kind === "note" &&
    tokens[head - 2].kind === "number"
  ) {
    head -= 2;
  }

  const parcels: Parcel[] = [];
  let pending: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === "number") {
      parcels.push({ value: t.value, note: pending });
      pending = null;
    } else if (i >= head) {
      parcels[parcels.length - 1].note = t.note;
    } else {
      if (pending !== null) return [];
      pending = t.note;
    }
  }

  if (pending !== null) return [];
  return parcels;
}
/**
 * As parcelas so servem para mostrar detalhe se somarem ao que a celula vale.
 *
 * Uma leitura que nao bate com o valor em cache e uma leitura errada, e uma
 * lista de compras que nao soma ao total do mes e pior do que lista nenhuma --
 * o utilizador tem de poder confiar nela para reconciliar. A tolerancia e de um
 * centimo, pelo mesmo ruido de virgula flutuante que o sheet-write ja trata.
 */
export function parcelsMatch(parcels: Parcel[], sheetValue: number): boolean {
  if (parcels.length === 0) return false;
  const total = parcels.reduce((acc, p) => acc + p.value, 0);
  return Math.abs(total - sheetValue) < 0.005;
}

/**
 * As parcelas de uma celula, com o valor da propria celula como rede.
 *
 * O parseParcels e deliberadamente severo: recusa tudo o que nao seja uma soma
 * simples, para nunca inventar uma composicao. Mas a maior parte das celulas da
 * folha nao tem formula nenhuma -- e um numero escrito a mao -- e algumas tem
 * uma formula que nao e uma soma (`95.83*2`, `-(106.66+78.58)`). Deixa-las de
 * fora fazia a lista do mes perder a maioria das categorias, e uma lista com
 * buracos parece avariada.
 *
 * Nesses casos a celula conta como UMA parcela do seu proprio valor. Nao mente
 * sobre dinheiro nenhum -- o valor esta certo e a soma bate. Diz apenas "uma
 * entrada deste valor" onde podem ter sido duas, que e o mais que se sabe sem
 * inventar.
 */
export function cellParcels(
  formula: string | null,
  sheetValue: number
): Parcel[] {
  const parsed = parseParcels(formula);
  if (parcelsMatch(parsed, sheetValue)) return parsed;
  return [{ value: sheetValue, note: null }];
}
