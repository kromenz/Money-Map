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

/**
 * Um numero, com sinal e decimais opcionais, seguido de um `N("...")`
 * opcional. O `(?:[^"]|"")*` da etiqueta e deliberadamente permissivo: o que
 * la esta dentro e texto do utilizador e nao se interpreta.
 *
 * O espaco e tolerado ENTRE as pecas mas nunca removido do texto todo de uma
 * vez -- as etiquetas tem espacos lá dentro ("AAPL_US_EQ 2026-09-15", "T212
 * juros 2026-09"), e limpa-los a monte transformava-as noutra coisa.
 */
const TOKEN = /^([+-]?)\s*(\d+(?:\.\d+)?)(?:\s*\+\s*N\(\s*"((?:[^"]|"")*)"\s*\))?/;

/**
 * As parcelas de uma formula, ou lista vazia quando ela nao e uma soma simples.
 *
 * Recusar e o comportamento certo para tudo o que nao seja uma sequencia de
 * numeros: um `SUM(C21:C28)` de subtotal ou um `-(A1+A2)` nao tem parcelas no
 * sentido que interessa aqui, e inventar uma leitura para eles daria uma lista
 * de compras que nunca existiu. Mais vale nao mostrar nada do que mostrar
 * errado -- e o mesmo criterio que o resto desta app usa com dinheiro.
 */
export function parseParcels(formula: string | null): Parcel[] {
  if (!formula) return [];

  // O `=` inicial pode vir ou nao, conforme quem entrega a formula.
  let rest = formula.trim().replace(/^=/, "").trim();
  if (rest === "") return [];

  const parcels: Parcel[] = [];

  while (rest.length > 0) {
    const m = TOKEN.exec(rest);
    if (!m) return [];

    const [matched, sign, digits, note] = m;
    const value = Number(`${sign === "-" ? "-" : ""}${digits}`);
    if (!Number.isFinite(value)) return [];

    parcels.push({
      value,
      // As aspas duplicadas voltam a ser uma so: e a escapagem que o
      // sheet-write aplicou ao escrever.
      note: note === undefined ? null : note.replace(/""/g, '"'),
    });

    rest = rest.slice(matched.length).replace(/^\s+/, "");
    if (rest === "") break;

    // Entre parcelas so pode vir o operador. Um `*`, um `(` ou uma referencia
    // a outra celula querem dizer que isto nao e uma soma simples.
    if (rest[0] !== "+" && rest[0] !== "-") return [];
    // O sinal fica para o TOKEN da parcela seguinte ler; um `+` explicito e
    // consumido, porque o TOKEN aceita-o como sinal opcional.
    if (rest[0] === "+") rest = rest.slice(1);
    if (rest.trim() === "") return [];
  }

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
