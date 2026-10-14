import { prisma } from "../../db/prisma";

export type NoteSuggestion = {
  note: string;
  /** Quantas parcelas ja foram escritas com esta etiqueta. */
  uses: number;
};

/**
 * Tecto da lista. Duzentas etiquetas distintas sao mais do que uma folha de um
 * ano produz, e a barra so mostra meia duzia de cada vez -- o resto do trabalho
 * de escolher e feito no cliente, sobre esta lista ja carregada, para escrever
 * uma letra nao custar um pedido.
 */
export const NOTE_LIMIT = 200;

/**
 * As etiquetas que este utilizador ja escreveu, das mais usadas para as menos.
 *
 * Serve a sugestao da barra de lancamento: escolher "Buenissima" da lista em
 * vez de a escrever outra vez com outra caixa e o que impede as variantes de
 * nascerem. Nao normaliza nem corrige nada do que ja esta escrito -- a folha e
 * a fonte de verdade do utilizador, e o texto e dele.
 *
 * Sem filtro de seccao: a barra escreve nas tres, e uma etiqueta usada numa
 * linha de income e na mesma uma etiqueta que ele ja usou.
 */
export async function getNoteSuggestions(
  userId: string
): Promise<NoteSuggestion[]> {
  const rows = await prisma.sheetParcel.groupBy({
    by: ["note"],
    where: { userId, note: { not: null } },
    _count: { note: true },
    // Desempate pelo texto: sem ele duas etiquetas com o mesmo numero de usos
    // trocavam de lugar entre pedidos, e a lista dancava debaixo do rato.
    orderBy: [{ _count: { note: "desc" } }, { note: "asc" }],
    take: NOTE_LIMIT,
  });

  return rows
    .filter((r): r is typeof r & { note: string } => r.note !== null)
    .map((r) => ({ note: r.note, uses: r._count.note }));
}
