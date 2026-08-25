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
 * Os juros nao vao um por movimento como o resto: sao ~0,20 EUR/dia, e um
 * lancamento por dia enchia a grelha com centenas de linhas para 31 EUR no
 * total. Agregam-se por mes, num lancamento so.
 *
 * O identificador e o mes, e nao o movimento, porque o mes em curso volta a
 * ser calculado a cada sincronizacao com mais um dia de juros dentro. E por
 * isso que o reconcilePlan precisa de saber actualizar: este e o unico
 * externalId cujo valor muda depois de existir.
 */
export const INTEREST_PREFIX = `${BRIDGE_PREFIX}interest:`;

function isInterest(type: CashFlowKind): boolean {
  return type === "INTEREST_ON_FREE_CASH" || type === "LENDING_INTEREST";
}

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

  // Acumulador dos juros por mes. O corte aplica-se ao movimento diario e nao
  // ao agregado: um corte a meio do mes (o T212_BRIDGE_FROM e escrito a mao e
  // nao tem de cair no dia 1) deixa entrar so a parte do mes que atravessa.
  const interest = new Map<string, { first: string; total: Prisma.Decimal }>();

  for (const c of source.cashflows) {
    const date = day(c.dateTime);
    if (!crossesToBudget(c.type, date, cutoff)) continue;

    if (isInterest(c.type)) {
      const month = date.slice(0, 7);
      const acc = interest.get(month);
      if (!acc) {
        interest.set(month, { first: date, total: new Prisma.Decimal(c.amount) });
      } else {
        acc.total = acc.total.add(c.amount);
        // O primeiro dia e nao o ultimo: a data do agregado tem de ser estavel
        // enquanto o mes corre. Com o ultimo dia, cada sincronizacao mudava
        // tambem a data e nao so o valor, e a actualizacao passava a ter de
        // mexer em dois campos em vez de um. Os movimentos chegam da API sem
        // ordem garantida, por isso e um minimo e nao o primeiro que se ve.
        if (date < acc.first) acc.first = date;
      }
      continue;
    }

    rows.push({
      externalId: BRIDGE_PREFIX + c.externalId,
      date,
      amount: storedAmount(CATEGORIES.transfers.section, c.amount),
      section: CATEGORIES.transfers.section,
      group: CATEGORIES.transfers.group,
      name: CATEGORIES.transfers.name,
      merchant: "Trading 212",
      rawDescription: `T212 ${c.type}`,
    });
  }

  // Ordenados para a saida ser determinista: o Map preserva a ordem de
  // insercao, que e a ordem em que a API entregou os movimentos, e essa pode
  // mudar entre corridas.
  for (const month of [...interest.keys()].sort()) {
    const acc = interest.get(month)!;
    rows.push({
      externalId: INTEREST_PREFIX + month,
      date: acc.first,
      amount: storedAmount(CATEGORIES.interest.section, acc.total.toFixed(2)),
      section: CATEGORIES.interest.section,
      group: CATEGORIES.interest.group,
      name: CATEGORIES.interest.name,
      merchant: "Trading 212",
      rawDescription: `T212 juros ${month}`,
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

export type BridgePlan = {
  toDelete: string[];
  toCreate: BridgeRow[];
  /**
   * Linhas que ja existem com o mesmo externalId mas outro valor. Na pratica
   * so o agregado mensal dos juros cai aqui: todos os outros externalId vem de
   * um movimento que a corretora nao volta a mexer.
   */
  toUpdate: BridgeRow[];
};

/**
 * O corte pode avancar quando se importa uma folha nova. Recalcular o desejado
 * e comparar com o que esta em base e o que torna a ponte auto-corrigivel em
 * vez de acumular duplicados.
 */
export function reconcilePlan(
  existing: { externalId: string; amount: string }[],
  desired: BridgeRow[]
): BridgePlan {
  // A funcao nunca pode apagar nem actualizar o que nao foi ela a criar, seja
  // qual for a lista que lhe passarem -- a garantia nao pode depender da
  // disciplina de quem chama.
  const mine = existing.filter((e) => e.externalId.startsWith(BRIDGE_PREFIX));
  const amounts = new Map(mine.map((e) => [e.externalId, e.amount]));
  const desiredIds = new Set(desired.map((d) => d.externalId));

  return {
    toDelete: mine.map((e) => e.externalId).filter((id) => !desiredIds.has(id)),
    toCreate: desired.filter((d) => !amounts.has(d.externalId)),
    // Decimal e nao comparacao de strings: os dois lados sao produzidos por
    // toFixed(2), mas "-0.00" e "0.00" sao a mesma quantia escrita de duas
    // maneiras, e um mes de juros que se anule daria uma actualizacao eterna.
    toUpdate: desired.filter((d) => {
      const current = amounts.get(d.externalId);
      return current !== undefined && !new Prisma.Decimal(current).equals(d.amount);
    }),
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
  /**
   * Traz o valor e nao so o identificador: sem ele o reconcilePlan nao tem
   * como saber que o agregado mensal dos juros mudou desde a ultima corrida.
   */
  existingBridgeRows(
    userId: string
  ): Promise<{ externalId: string; amount: string }[]>;
  applyBridge(
    userId: string,
    plan: BridgePlan
  ): Promise<{ created: number; deleted: number; updated: number }>;
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
): Promise<{ created: number; deleted: number; updated: number }> {
  const cutoff =
    explicitCutoff ?? derivedCutoff(await repo.lastExcelMonth(userId));
  const desired = bridgeRows(await repo.bridgeSource(userId), cutoff);
  const plan = reconcilePlan(await repo.existingBridgeRows(userId), desired);
  return repo.applyBridge(userId, plan);
}
