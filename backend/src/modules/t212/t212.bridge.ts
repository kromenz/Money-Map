import { Prisma } from "@prisma/client";
import { toStored } from "../budget/budget.grid";
import type { CashFlowKind } from "./t212.map";

export type BridgeSection = "income" | "savings" | "expenses";

export type BridgeRow = {
  externalId: string;
  /** YYYY-MM-DD. */
  date: string;
  amount: string;
  section: BridgeSection;
  group: string;
  name: string;
  merchant: string;
  rawDescription: string;
};

export type BridgeSource = {
  cashflows: {
    externalId: string;
    dateTime: string;
    type: CashFlowKind;
    amount: string;
  }[];
  dividends: {
    externalId: string;
    paidOn: string;
    ticker: string;
    amountInEuro: string;
  }[];
};

/**
 * Sem este prefixo nao havia como distinguir o que a ponte criou do que foi
 * registado a mao -- e a reconciliacao do corte apagaria despesas do
 * utilizador.
 */
export const BRIDGE_PREFIX = "t212:";

/**
 * As categorias resolvem-se por (section, group, name), a mesma chave do
 * PendingExpense. Se a folha ja tiver categorias equivalentes com outro nome,
 * e aqui que se muda -- num sitio, nao espalhado pelo codigo.
 */
export const CATEGORIES = {
  transfers: { section: "savings" as const, group: "", name: "Trading 212" },
  dividends: { section: "income" as const, group: "", name: "Dividends" },
  interest: { section: "income" as const, group: "", name: "Interest" },
};

// As datas comparam-se em referencial UTC: day() fatia o ISO sem passar por
// getters locais, e derivedCutoff() espera um { year, month } ja calculado em
// UTC por quem chama. Um dos dois lados a usar hora local desalinha o corte
// perto da meia-noite.
function day(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Limite superior (exclusivo) das transacoes da folha que ja aconteceram: o
 * primeiro instante do mes seguinte ao de agora, em UTC.
 *
 * O parser cria uma celula para qualquer mes com valor nao-nulo, meses futuros
 * incluidos -- uma renda fixa preenchida ate Dezembro, um seguro anual. Sem
 * este limite, o maximo global sobre as transacoes de origem `excel` devolvia
 * Dezembro, o derivedCutoff devolvia Janeiro do ano seguinte, e a ponte nao
 * escrevia nada durante o ano inteiro. O utilizador via "movimentos anteriores
 * a 2027-01-01 nao entram na grelha" e nao tinha como perceber porque.
 *
 * O mes corrente conta: as transacoes da folha ficam gravadas no dia 1 ao
 * meio-dia UTC, portanto a do mes de agora e sempre anterior a este limite.
 */
export function excelMonthCap(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** O primeiro dia nao coberto pela folha. Sem folha, nao ha corte. */
export function derivedCutoff(
  last: { year: number; month: number } | null
): string | null {
  if (!last) return null;
  const year = last.month === 12 ? last.year + 1 : last.year;
  const month = last.month === 12 ? 1 : last.month + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Fonte unica da regra "este movimento de caixa entra no orcamento". O
 * bridgeRows usa-a para decidir o que escrever na folha, e a rota
 * GET /t212/cashflows usa-a para anotar cada item com crossesBudget -- a
 * interface le a resposta, nunca copia esta expressao para o frontend.
 */
export function crossesToBudget(
  type: CashFlowKind,
  date: string,
  cutoff: string | null
): boolean {
  // FEE nao atravessa: a taxa ja esta reflectida no valor da execucao, e
  // conta-la outra vez duplicava a despesa. TRANSFER e ambiguo na API --
  // regista-se, mas nao se interpreta.
  if (type === "FEE" || type === "TRANSFER") return false;
  return cutoff === null || date >= cutoff;
}

/**
 * O `amount` de um BridgeRow ja vai na convencao de armazenamento do
 * Transaction, nao na da folha -- e o que o applyBridge grava tal e qual.
 *
 * A T212 entrega os movimentos na convencao da folha (um deposito e +500, um
 * levantamento e -100), e a base de dados guarda `savings`/`expenses`
 * invertidos. Escrever o valor cru fazia a grelha mostrar -500,00 EUR num
 * deposito de 500 EUR.
 */
function storedAmount(section: BridgeSection, sheetValue: string): string {
  return toStored(section, new Prisma.Decimal(sheetValue)).toFixed(2);
}

export function bridgeRows(
  source: BridgeSource,
  cutoff: string | null
): BridgeRow[] {
  const rows: BridgeRow[] = [];
  const after = (date: string) => cutoff === null || date >= cutoff;

  for (const c of source.cashflows) {
    const date = day(c.dateTime);
    if (!crossesToBudget(c.type, date, cutoff)) continue;

    const income =
      c.type === "INTEREST_ON_FREE_CASH" || c.type === "LENDING_INTEREST";
    const category = income ? CATEGORIES.interest : CATEGORIES.transfers;

    rows.push({
      externalId: BRIDGE_PREFIX + c.externalId,
      date,
      amount: storedAmount(category.section, c.amount),
      section: category.section,
      group: category.group,
      name: category.name,
      merchant: "Trading 212",
      rawDescription: `T212 ${c.type}`,
    });
  }

  for (const d of source.dividends) {
    const date = day(d.paidOn);
    if (!after(date)) continue;

    rows.push({
      externalId: BRIDGE_PREFIX + d.externalId,
      date,
      amount: storedAmount(CATEGORIES.dividends.section, d.amountInEuro),
      section: CATEGORIES.dividends.section,
      group: CATEGORIES.dividends.group,
      name: CATEGORIES.dividends.name,
      merchant: d.ticker,
      rawDescription: `T212 dividendo ${d.ticker}`,
    });
  }

  return rows;
}

/**
 * O corte pode avancar quando se importa uma folha nova. Recalcular o desejado
 * e comparar com o que esta em base e o que torna a ponte auto-corrigivel em
 * vez de acumular duplicados.
 */
export function reconcilePlan(
  existing: { externalId: string }[],
  desired: BridgeRow[]
): { toDelete: string[]; toCreate: BridgeRow[] } {
  // A funcao nunca pode apagar o que nao foi ela a criar, seja qual for a
  // lista que lhe passarem -- a garantia nao pode depender da disciplina de
  // quem chama.
  const existingBridgeIds = existing
    .map((e) => e.externalId)
    .filter((id) => id.startsWith(BRIDGE_PREFIX));

  const desiredIds = new Set(desired.map((d) => d.externalId));
  const existingIds = new Set(existingBridgeIds);

  return {
    toDelete: existingBridgeIds.filter((id) => !desiredIds.has(id)),
    toCreate: desired.filter((d) => !existingIds.has(d.externalId)),
  };
}

/**
 * O que a etapa `bridge` do syncAll precisa do repositorio, e nada mais. O
 * SyncRepo satisfaz esta forma; declara-la aqui e o que permite ao import da
 * folha correr a mesma reconciliacao sem arrastar o modulo de sincronizacao
 * inteiro atras dela.
 */
export type BridgeRepo = {
  lastExcelMonth(
    userId: string
  ): Promise<{ year: number; month: number } | null>;
  bridgeSource(userId: string): Promise<BridgeSource>;
  existingBridgeIds(userId: string): Promise<{ externalId: string }[]>;
  applyBridge(
    userId: string,
    plan: { toDelete: string[]; toCreate: BridgeRow[] }
  ): Promise<{ created: number; deleted: number }>;
};

/**
 * O trio corte -> plano -> aplicacao, num sitio so.
 *
 * Tem dois chamadores: a etapa `bridge` do syncAll e o fim do
 * importBudgetWorkbook. Sao os dois momentos em que o corte pode ter mudado --
 * a sincronizacao traz movimentos novos, a importacao faz o corte avancar --
 * e um deles a correr uma versao propria desta sequencia era como a ponte
 * ficaria outra vez fora de passo com o orcamento.
 *
 * `explicitCutoff` e o corte do .env; null manda deriva-lo do Excel.
 */
export async function runBridge(
  userId: string,
  repo: BridgeRepo,
  explicitCutoff: string | null
): Promise<{ created: number; deleted: number }> {
  const cutoff =
    explicitCutoff ?? derivedCutoff(await repo.lastExcelMonth(userId));
  const desired = bridgeRows(await repo.bridgeSource(userId), cutoff);
  const plan = reconcilePlan(await repo.existingBridgeIds(userId), desired);
  return repo.applyBridge(userId, plan);
}
