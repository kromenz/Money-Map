// Uma entrada por posicao da rampa, nao por grupo: os nomes dos grupos vem do
// ficheiro importado e podem ter espacos, acentos ou "&", e as custom properties
// exigem identificadores CSS validos. Com chaves fixas as cores continuam a
// viver so no globals.css.
//
// Indexadas directamente, sem modulo: o groupExpenses (budget-metrics.ts)
// garante no maximo seis entradas -- TOP_GROUPS grupos mais Other -- e ciclar a
// rampa daria ao setimo a cor do primeiro. Estes seis slots e o TOP_GROUPS tem
// de subir juntos: mexer so num deixa SLOTS[6] a undefined e um segmento
// transparente.
export const SLOTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/**
 * A cor de um grupo na barra do mes, ou null se ele nao tiver la segmento.
 *
 * Vive fora do GroupComposition porque ha mais do que um bloco a pintar por
 * grupo -- a barra do "Where it went" e os cards do "What was bought" -- e na
 * mesma pagina a mesma cor tem de querer dizer a mesma coisa.
 *
 * Devolve null para quem caiu no "Other" agregado: dar-lhe a cor do agregado
 * dizia que ele *era* o agregado. Sem cor mente menos do que com a cor errada.
 * (Um grupo importado chamado literalmente "Other" apanha na mesma o segmento
 * do agregado -- e a colisao de nomes que o GroupComposition ja tinha.)
 */
export function slotOfGroup(
  byGroup: { group: string }[],
  group: string
): string | null {
  const i = byGroup.findIndex((g) => g.group === group);
  if (i === -1 || i >= SLOTS.length) return null;
  return SLOTS[i];
}
