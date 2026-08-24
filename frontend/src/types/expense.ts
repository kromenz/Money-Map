export type Section = "income" | "savings" | "expenses";

/** A chave de uma celula na folha: que categoria, que mes. */
export type SheetTarget = {
  section: Section;
  group: string;
  name: string;
  /** 1 = Janeiro. */
  month: number;
};

export type NewExpense = SheetTarget & { amount: number };

export type AddExpenseResponse =
  | { status: "written"; year: number }
  | { status: "pending"; year: number; count: number }
  | { status: "error"; reason: string };

export type FlushResponse = {
  applied: number;
  stillPending: number;
  failures: { year: number; reason: string }[];
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
};
