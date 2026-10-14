import type { NoteSuggestion } from "../types/notes";

/** Quantas sugestoes cabem na lista sem ela tapar a barra toda. */
export const SUGGESTION_LIMIT = 6;

/**
 * A chave por que duas etiquetas se consideram a mesma.
 *
 * Caixa, espacos e acentos -- e mais nada. Sao as tres diferencas que sao
 * seguramente ruido de teclado: qualquer pessoa que veja "Buenissima" e
 * "buenissima" lado a lado concorda que sao a mesma loja, e a regra explica-se
 * numa linha.
 *
 * De proposito sem semelhanca aproximada (Levenshtein e afins): "Continente" e
 * "Continente Bom Dia" sao lojas diferentes, e uma fusao errada e invisivel
 * para quem le -- aparece como um total que nao bate e nunca como um erro.
 */
export function noteKey(note: string): string {
  return note
    .normalize("NFD")
    // Marcas diacriticas separadas pelo NFD. Tira o acento e deixa a letra.
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * As etiquetas a sugerir para o que esta escrito no campo.
 *
 * Primeiro as que comecam pelo que foi escrito, depois as que o contem algures
 * -- dentro de cada bloco pela ordem que veio da API, que e a das mais usadas.
 * Quem escreve "cont" esta a comecar uma palavra, e a lista tem de responder a
 * isso antes de responder a popularidade.
 *
 * Nunca sugere a etiqueta que ja esta escrita por inteiro: nesse caso a lista
 * nao tem nada a acrescentar e ficar aberta so tapava o botao de submeter.
 */
export function suggestNotes(
  all: NoteSuggestion[],
  typed: string
): NoteSuggestion[] {
  const key = noteKey(typed);
  if (key === "") return all.slice(0, SUGGESTION_LIMIT);

  const starts: NoteSuggestion[] = [];
  const contains: NoteSuggestion[] = [];

  for (const s of all) {
    const k = noteKey(s.note);
    if (k === key) continue;
    if (k.startsWith(key)) starts.push(s);
    else if (k.includes(key)) contains.push(s);
  }

  return [...starts, ...contains].slice(0, SUGGESTION_LIMIT);
}
