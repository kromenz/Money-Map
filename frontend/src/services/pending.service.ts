import api from "../lib/api";

/**
 * Tira uma entrada da fila sem a aplicar.
 *
 * Vai directo a API, ao contrario do expense.service: nao toca na folha, por
 * isso nao precisa do route handler do Next, e assim apanha o interceptor que
 * renova o token.
 *
 * `cleared: 0` nao e erro: quer dizer que outro separador (ou um flush) ja a
 * tirou. O que o ecra precisa de saber e que ela ja nao esta la.
 */
export async function discardPending(id: string): Promise<void> {
  await api.post<{ cleared: number }>("/budget/pending/clear", { ids: [id] });
}
