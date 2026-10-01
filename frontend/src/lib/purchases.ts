import type { MonthParcels } from "../types/parcels";

export type PurchaseParcel = {
  seq: number;
  amount: number;
  /** null nas parcelas que a folha ja tinha antes de haver etiquetas. */
  note: string | null;
  /** Quantas parcelas com este nome a linha junta; 1 nas que nao tem nome. */
  count: number;
};

export type PurchaseCategory = {
  categoryId: string;
  group: string;
  name: string;
  /** "Home · Groceries", ou so o nome quando a categoria nao tem grupo. */
  label: string;
  total: number;
  /** Quantas compras houve, contadas antes de as juntar por nome. */
  items: number;
  /** Fatia da despesa do mes, entre 0 e 1. Ver a nota sobre reembolsos. */
  share: number;
  parcels: PurchaseParcel[];
};

export type PurchasesView = {
  /** A soma das categorias, para o cabecalho do cartao. */
  total: number;
  categories: PurchaseCategory[];
};

/**
 * Junta numa linha as parcelas com o mesmo nome: dois "Marvel-Must-Have" de
 * 11,95 sao a mesma coisa comprada duas vezes, e duas linhas iguais so faziam
 * a lista mais comprida sem dizer mais nada. O nome compara-se sem espacos a
 * volta nem maiusculas, e fica escrito como na primeira vez que a folha o tem.
 *
 * As parcelas sem nome nunca se juntam: nao ter etiqueta nao as faz iguais.
 */
function groupByNote(
  parcels: MonthParcels["categories"][number]["parcels"]
): PurchaseParcel[] {
  const out: PurchaseParcel[] = [];
  const byKey = new Map<string, PurchaseParcel>();

  for (const p of [...parcels].sort((a, b) => a.seq - b.seq)) {
    const amount = Number(p.amount);
    const note = p.note?.trim() || null;
    if (note === null) {
      out.push({ seq: p.seq, amount, note: null, count: 1 });
      continue;
    }
    const key = note.toLocaleLowerCase();
    const seen = byKey.get(key);
    if (seen) {
      // Ao centimo: 8.97+5.98 da 14.950000000000001 em binario.
      seen.amount = Math.round((seen.amount + amount) * 100) / 100;
      seen.count += 1;
    } else {
      const row = { seq: p.seq, amount, note, count: 1 };
      byKey.set(key, row);
      out.push(row);
    }
  }

  return out;
}

/**
 * A vista do cartao "What was bought" a partir do que a API devolve.
 *
 * A API manda pela ordem da folha, que e a ordem por que o utilizador esta
 * habituado a olhar para ela na grelha. Aqui a ordem e outra de proposito: no
 * carrossel a pergunta e "onde foi o dinheiro", e a resposta e a categoria
 * maior primeiro. Por isso a ordenacao vive neste lado e nao na query -- a
 * grelha e este cartao querem ordens diferentes dos mesmos dados.
 *
 * Converte os decimais em string num sitio so: a partir daqui e tudo number.
 */
export function purchasesView(data: MonthParcels): PurchasesView {
  const categories = data.categories.map((c) => ({
    categoryId: c.categoryId,
    group: c.group,
    name: c.name,
    label: c.group === "" ? c.name : `${c.group} · ${c.name}`,
    total: Number(c.total),
    items: c.parcels.length,
    share: 0,
    parcels: groupByNote(c.parcels)
      // Empate pelo seq -- a ordem em que a folha as escreveu. Sem este
      // criterio a lista podia trocar de ordem entre renderizacoes com os
      // mesmos dados, e duas subscricoes de 10,00 EUR trocavam de sitio.
      .sort((a, b) => b.amount - a.amount || a.seq - b.seq),
  }));

  categories.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const total = categories.reduce((s, c) => s + c.total, 0);

  for (const c of categories) {
    // Um reembolso pode fechar a categoria negativa. O total mostra-se como e,
    // mas a quota fica em zero: um segmento de comprimento negativo nao
    // existe. E a mesma decisao que o GroupComposition ja tomou para a barra
    // do "Where it went".
    c.share = total > 0 ? Math.max(0, c.total / total) : 0;
  }

  return { total, categories };
}
