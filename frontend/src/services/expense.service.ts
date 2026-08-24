import type { AddExpenseResponse, FlushResponse, NewExpense } from "../types/expense";

/**
 * Chama o route handler do proprio Next, nao a API. E por isso que nao usa o
 * cliente axios: esse aponta para a API e traz o interceptor de renovacao, que
 * aqui nao serve. Mesma razao do folder-scan.service.
 */
export async function addExpense(
  input: NewExpense & { year: number }
): Promise<AddExpenseResponse> {
  const res = await fetch("/api/expense", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  return (await res.json()) as AddExpenseResponse;
}

export async function flushPending(): Promise<FlushResponse> {
  const res = await fetch("/api/expense/flush", { method: "POST" });
  if (!res.ok) throw new Error(`Flush failed (${res.status})`);
  return (await res.json()) as FlushResponse;
}
