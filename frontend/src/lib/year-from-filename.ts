/** Os mesmos limites do importQuerySchema do backend. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * O ano que o nome do ficheiro anuncia, ou null se nao anunciar nenhum.
 *
 * A folha nao declara o ano em lado nenhum: o parseBudgetWorkbook do backend
 * recebe-o como parametro e limita-se a carimba-lo no resultado. Sobra o nome
 * do ficheiro.
 *
 * So conta uma corrida de exactamente quatro digitos, para 12026.xlsx nao dar
 * 2026. Um candidato fora da gama e saltado sem interromper a busca: em
 * 1999-2026.xlsx o ano e 2026.
 */
export function yearFromFileName(name: string): number | null {
  for (const match of name.matchAll(/(?<!\d)\d{4}(?!\d)/g)) {
    const year = Number(match[0]);
    if (year >= MIN_YEAR && year <= MAX_YEAR) return year;
  }
  return null;
}
