import type { GridRow } from "@/types/budget";

export type Section = GridRow["section"];

/**
 * A ordem por que a folha esta escrita, e nao a que a grelha devolve.
 *
 * A grelha ordena as linhas por seccao alfabetica -- expenses, income,
 * savings -- porque e assim que saem do Postgres. Ele olha para o Excel todos
 * os meses pela ordem de baixo, e sao botoes que vao estar sempre no mesmo
 * sitio: convem que a posicao seja a que ele ja tem na cabeca.
 */
const SHEET_ORDER: readonly Section[] = ["income", "savings", "expenses"];

/**
 * As seccoes que esta folha tem, pela ordem da folha.
 *
 * Sai do que foi importado e nao de uma lista fixa: nem toda a folha tem
 * Savings, e um botao que filtra para uma lista vazia so faz o utilizador
 * perguntar-se o que fez de errado. Um unico elemento aqui e tambem o sinal
 * para nao desenhar a fila de todo.
 */
export function sectionsPresent(rows: GridRow[]): Section[] {
  const seen = new Set(rows.map((r) => r.section));
  return SHEET_ORDER.filter((s) => seen.has(s));
}

/**
 * Por onde a barra abre. Despesas, quando as ha: e o lancamento do dia-a-dia,
 * e abrir noutro sitio custava um clique em todos os outros dias.
 *
 * Null quando nao ha linha nenhuma -- a barra esconde-se sozinha nesse caso,
 * mas a resposta nao pode ser uma seccao que a folha nao tem.
 */
export function defaultSection(rows: GridRow[]): Section | null {
  const present = sectionsPresent(rows);
  if (present.includes("expenses")) return "expenses";
  return present[0] ?? null;
}

/** O nome curto da seccao, para o filtro. */
export const SECTION_LABELS: Record<Section, string> = {
  income: "Income",
  savings: "Savings",
  expenses: "Expenses",
};

/**
 * O que o botao promete escrever. Dizer "Add expense" com a seccao em Income
 * era o botao a contradizer o filtro que esta ao lado dele.
 */
export function addLabel(section: Section): string {
  if (section === "income") return "Add income";
  if (section === "savings") return "Add saving";
  return "Add expense";
}
