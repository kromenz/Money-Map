export type Section = "income" | "savings" | "expenses";

/** A chave de uma celula na folha: que categoria, que mes. */
export type SheetTarget = {
  section: Section;
  group: string;
  name: string;
  /** 1 = Janeiro. */
  month: number;
};

export type NewExpense = SheetTarget & {
  amount: number;
  /**
   * Etiqueta a acompanhar este valor dentro da formula da celula, como
   * `N("PS5")`. Opcional: sem ela a celula fica com o numero a seco, que e
   * como sempre esteve.
   */
  note?: string;
};

export type AddExpenseResponse =
  | { status: "written"; year: number }
  | { status: "pending"; year: number; count: number }
  | { status: "error"; reason: string };

export type FlushResponse = {
  applied: number;
  /** Inclui as rejeitadas: continuam na fila ate serem descartadas. */
  stillPending: number;
  failures: { year: number; reason: string }[];
  /**
   * Entradas que a folha do seu ano nao tem onde por -- tipicamente uma
   * categoria renomeada ou apagada depois de o gasto ter entrado na fila.
   * Vem com os dados todos para o ecra as mostrar sem outro pedido.
   */
  rejected: RejectedPending[];
};

export type PendingExpense = {
  id: string;
  year: number;
  month: number;
  section: Section;
  group: string;
  name: string;
  /** Decimal em string, como tudo o que o backend devolve em dinheiro. */
  amount: string;
  /** A etiqueta escrita quando o gasto foi registado, se levou alguma. */
  note: string | null;
};

export type RejectedPending = PendingExpense & { reason: string };
