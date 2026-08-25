import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toDisplay } from "../budget/budget.grid";
import { bridgeRows, reconcilePlan, derivedCutoff, crossesToBudget, BRIDGE_PREFIX } from "./t212.bridge";

const cashflow = (externalId: string, dateTime: string, type: string, amount: string) =>
  ({ externalId, dateTime, type, amount } as never);

const source = {
  cashflows: [
    cashflow("d-1", "2026-09-03T09:00:00Z", "DEPOSIT", "500.00"),
    cashflow("w-1", "2026-09-10T09:00:00Z", "WITHDRAW", "-100.00"),
    cashflow("f-1", "2026-09-11T09:00:00Z", "FEE", "-0.70"),
    cashflow("t-1", "2026-09-12T09:00:00Z", "TRANSFER", "40.00"),
    cashflow("i-1", "2026-09-13T09:00:00Z", "INTEREST_ON_FREE_CASH", "1.20"),
  ],
  dividends: [
    { externalId: "div-1", paidOn: "2026-09-15T00:00:00Z", ticker: "AAPL_US_EQ", amountInEuro: "1.31" },
  ],
};

describe("bridgeRows", () => {
  // O sinal destas asercoes parece invertido de proposito. O bridgeRows nao
  // devolve o valor como a T212 o entrega (convencao da folha): devolve-o ja na
  // convencao de armazenamento do Transaction, a mesma que o toStored do
  // budget.grid.ts impoe ao import do Excel -- `savings` e `expenses` gravam-se
  // com o sinal trocado, `income` grava-se tal e qual.
  //
  // Ate a correccao C1 estes testes fixavam o valor cru ("500.00" num
  // deposito), e por causa disso a grelha do orcamento mostrava -500,00 EUR
  // numa poupanca de 500 EUR. Quem achar que o "-500.00" aqui e um erro deve
  // ler o toStored primeiro: a grelha desfaz esta inversao ao ler.
  it("um deposito grava-se como poupanca negativa, que a grelha mostra a positivo", () => {
    const row = bridgeRows(source, null).find((r) => r.externalId === `${BRIDGE_PREFIX}d-1`);
    expect(row).toMatchObject({ section: "savings", amount: "-500.00", date: "2026-09-03" });
  });

  it("um levantamento grava-se positivo, que a grelha mostra a negativo", () => {
    const row = bridgeRows(source, null).find((r) => r.externalId === `${BRIDGE_PREFIX}w-1`);
    expect(row).toMatchObject({ section: "savings", amount: "100.00" });
  });

  it("dividendos e juros viram receita, onde as duas convencoes coincidem", () => {
    const rows = bridgeRows(source, null);
    expect(rows.find((r) => r.externalId === `${BRIDGE_PREFIX}div-1`)).toMatchObject({
      section: "income",
      amount: "1.31",
      merchant: "AAPL_US_EQ",
    });
    expect(rows.find((r) => r.externalId === `${BRIDGE_PREFIX}i-1`)).toMatchObject({
      section: "income",
      amount: "1.20",
    });
  });

  it("o que a ponte grava, a grelha mostra na convencao da folha", () => {
    // A garantia que interessa ao utilizador nao e o sinal em base: e que o
    // numero que ele ve bate com o extracto do broker. toDisplay e a leitura
    // que a grelha faz, portanto e aqui que se fecha o circuito.
    const rows = bridgeRows(source, null);
    const visto = (id: string) => {
      const row = rows.find((r) => r.externalId === `${BRIDGE_PREFIX}${id}`)!;
      return toDisplay(row.section, new Prisma.Decimal(row.amount)).toFixed(2);
    };

    expect(visto("d-1")).toBe("500.00");
    expect(visto("w-1")).toBe("-100.00");
    expect(visto("div-1")).toBe("1.31");
  });

  it("taxas e transferencias nao atravessam", () => {
    const ids = bridgeRows(source, null).map((r) => r.externalId);
    expect(ids).not.toContain(`${BRIDGE_PREFIX}f-1`);
    expect(ids).not.toContain(`${BRIDGE_PREFIX}t-1`);
  });

  it("nada anterior ao corte atravessa", () => {
    const rows = bridgeRows(source, "2026-09-12");
    expect(rows.map((r) => r.externalId)).toEqual([
      `${BRIDGE_PREFIX}i-1`,
      `${BRIDGE_PREFIX}div-1`,
    ]);
  });

  it("o proprio dia do corte atravessa", () => {
    const rows = bridgeRows(source, "2026-09-03");
    expect(rows.map((r) => r.externalId)).toContain(`${BRIDGE_PREFIX}d-1`);
  });

  it("todos os externalId levam o prefixo -- e o que os torna reversiveis", () => {
    expect(bridgeRows(source, null).every((r) => r.externalId.startsWith(BRIDGE_PREFIX))).toBe(true);
  });
});

describe("crossesToBudget", () => {
  it("os dois tipos de juros atravessam", () => {
    expect(crossesToBudget("INTEREST_ON_FREE_CASH", "2026-09-13", null)).toBe(true);
    expect(crossesToBudget("LENDING_INTEREST", "2026-09-13", null)).toBe(true);
  });

  it("taxa e transferencia nao atravessam", () => {
    expect(crossesToBudget("FEE", "2026-09-13", null)).toBe(false);
    expect(crossesToBudget("TRANSFER", "2026-09-13", null)).toBe(false);
  });

  it("um deposito anterior ao corte nao atravessa", () => {
    expect(crossesToBudget("DEPOSIT", "2026-09-01", "2026-09-12")).toBe(false);
  });

  it("sem corte definido atravessa tudo o que nao seja taxa nem transferencia", () => {
    expect(crossesToBudget("DEPOSIT", "2020-01-01", null)).toBe(true);
    expect(crossesToBudget("WITHDRAW", "2020-01-01", null)).toBe(true);
    expect(crossesToBudget("INTEREST_ON_FREE_CASH", "2020-01-01", null)).toBe(true);
  });
});

describe("derivedCutoff", () => {
  it("o corte e o dia seguinte ao ultimo mes coberto pelo Excel", () => {
    expect(derivedCutoff({ year: 2026, month: 4 })).toBe("2026-05-01");
  });

  it("dezembro passa para janeiro do ano seguinte", () => {
    expect(derivedCutoff({ year: 2026, month: 12 })).toBe("2027-01-01");
  });

  it("sem dados do Excel nao ha corte e entra tudo", () => {
    expect(derivedCutoff(null)).toBeNull();
  });
});

describe("reconcilePlan", () => {
  const desired = bridgeRows(source, "2026-09-12");

  it("cria o que falta", () => {
    const plan = reconcilePlan([], desired);
    expect(plan.toCreate).toHaveLength(desired.length);
    expect(plan.toDelete).toEqual([]);
  });

  it("nao recria o que ja existe", () => {
    const plan = reconcilePlan(desired.map((d) => ({ externalId: d.externalId })), desired);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("apaga o que deixou de ser desejado quando o corte avanca", () => {
    // Ja existiam linhas de setembro; uma folha nova passou a cobrir setembro
    // e o corte avancou para outubro.
    const existing = bridgeRows(source, null).map((d) => ({ externalId: d.externalId }));
    const plan = reconcilePlan(existing, bridgeRows(source, "2026-10-01"));

    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toHaveLength(existing.length);
    expect(plan.toDelete.every((id) => id.startsWith(BRIDGE_PREFIX))).toBe(true);
  });

  it("nunca apaga uma despesa sem o prefixo, mesmo que o chamador passe a lista toda", () => {
    // Se um dia alguem passar aqui todas as transaccoes em vez de so as da
    // ponte, a funcao tem de se defender sozinha -- nao pode confiar na
    // disciplina de quem a chama.
    const existing = [{ externalId: "manual-1" }];
    const plan = reconcilePlan(existing, []);

    expect(plan.toDelete).not.toContain("manual-1");
    expect(plan.toDelete).toEqual([]);
  });
});
