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

/** O primeiro dia nao coberto pela folha. Sem folha, nao ha corte. */
export function derivedCutoff(
  last: { year: number; month: number } | null
): string | null {
  if (!last) return null;
  const year = last.month === 12 ? last.year + 1 : last.year;
  const month = last.month === 12 ? 1 : last.month + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function bridgeRows(
  source: BridgeSource,
  cutoff: string | null
): BridgeRow[] {
  const rows: BridgeRow[] = [];
  const after = (date: string) => cutoff === null || date >= cutoff;

  for (const c of source.cashflows) {
    const date = day(c.dateTime);
    if (!after(date)) continue;

    // FEE nao atravessa: a taxa ja esta reflectida no valor da execucao, e
    // conta-la outra vez duplicava a despesa. TRANSFER e ambiguo na API --
    // regista-se, mas nao se interpreta.
    if (c.type === "FEE" || c.type === "TRANSFER") continue;

    const income =
      c.type === "INTEREST_ON_FREE_CASH" || c.type === "LENDING_INTEREST";
    const category = income ? CATEGORIES.interest : CATEGORIES.transfers;

    rows.push({
      externalId: BRIDGE_PREFIX + c.externalId,
      date,
      amount: c.amount,
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
      amount: d.amountInEuro,
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
