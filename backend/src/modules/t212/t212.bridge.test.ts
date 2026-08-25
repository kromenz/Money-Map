import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { toDisplay } from "../budget/budget.grid";
import {
  bridgeRows,
  reconcilePlan,
  derivedCutoff,
  crossesToBudget,
  excelMonthCap,
  runBridge,
  BRIDGE_PREFIX,
  INTEREST_PREFIX,
  type BridgeRepo,
  type BridgeRow,
} from "./t212.bridge";

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
    expect(rows.find((r) => r.externalId === `${INTEREST_PREFIX}2026-09`)).toMatchObject({
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
      `${INTEREST_PREFIX}2026-09`,
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

describe("bridgeRows -- juros agregados por mes", () => {
  // ~0,20 EUR/dia. Um lancamento por dia sao 311 linhas desde Janeiro de 2025
  // para 31 EUR no total, e a grelha do orcamento fica ilegivel. Agregam-se.
  const juros = {
    cashflows: [
      cashflow("i-a", "2026-09-01T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.20"),
      cashflow("i-b", "2026-09-02T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.21"),
      cashflow("i-c", "2026-09-03T09:00:00Z", "LENDING_INTEREST", "0.05"),
      cashflow("i-d", "2026-10-01T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.22"),
    ],
    dividends: [],
  };

  it("um mes de juros da um lancamento so, com a soma la dentro", () => {
    const rows = bridgeRows(juros, null);
    const setembro = rows.filter((r) => r.externalId.startsWith(INTEREST_PREFIX));

    expect(setembro).toHaveLength(2);
    expect(rows.find((r) => r.externalId === `${INTEREST_PREFIX}2026-09`)).toMatchObject({
      amount: "0.46",
      section: "income",
      name: "Interest",
    });
  });

  it("as duas especies de juros somam no mesmo lancamento", () => {
    // LENDING_INTEREST e INTEREST_ON_FREE_CASH sao a mesma linha do orcamento;
    // separa-los dava duas linhas de cêntimos onde o utilizador espera uma.
    const rows = bridgeRows(
      { cashflows: [juros.cashflows[2]], dividends: [] },
      null
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: `${INTEREST_PREFIX}2026-09`, amount: "0.05" });
  });

  it("meses diferentes ficam em lancamentos diferentes", () => {
    const ids = bridgeRows(juros, null).map((r) => r.externalId);
    expect(ids).toContain(`${INTEREST_PREFIX}2026-09`);
    expect(ids).toContain(`${INTEREST_PREFIX}2026-10`);
  });

  it("a data do agregado e o primeiro dia de juros do mes, e nao o ultimo", () => {
    // Estavel enquanto o mes corre: com o ultimo dia, cada sincronizacao mudava
    // a data alem do valor e a actualizacao passava a mexer em dois campos.
    const row = bridgeRows(juros, null).find(
      (r) => r.externalId === `${INTEREST_PREFIX}2026-09`
    );
    expect(row!.date).toBe("2026-09-01");
  });

  it("a data e o minimo, mesmo com os movimentos fora de ordem", () => {
    const baralhados = {
      cashflows: [juros.cashflows[1], juros.cashflows[0]],
      dividends: [],
    };
    const row = bridgeRows(baralhados, null)[0];
    expect(row.date).toBe("2026-09-01");
  });

  it("o corte aplica-se ao movimento diario, nao ao mes inteiro", () => {
    // O T212_BRIDGE_FROM e escrito a mao e nao tem de cair no dia 1. Um corte
    // a meio do mes deixa entrar so a parte do mes que o atravessa.
    const row = bridgeRows(juros, "2026-09-02")
      .find((r) => r.externalId === `${INTEREST_PREFIX}2026-09`);
    expect(row).toMatchObject({ amount: "0.26", date: "2026-09-02" });
  });

  it("um mes inteiro anterior ao corte nao produz lancamento nenhum", () => {
    const ids = bridgeRows(juros, "2026-10-01").map((r) => r.externalId);
    expect(ids).not.toContain(`${INTEREST_PREFIX}2026-09`);
    expect(ids).toContain(`${INTEREST_PREFIX}2026-10`);
  });

  it("os depositos continuam um por movimento -- so os juros agregam", () => {
    const rows = bridgeRows(source, null);
    expect(rows.map((r) => r.externalId)).toContain(`${BRIDGE_PREFIX}d-1`);
    expect(rows.map((r) => r.externalId)).toContain(`${BRIDGE_PREFIX}w-1`);
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

describe("excelMonthCap", () => {
  // O parser cria uma celula para qualquer mes com valor nao-nulo, meses
  // futuros incluidos. Sem este limite, uma folha com a renda preenchida ate
  // Dezembro punha o corte em 2027-01-01 e a ponte nao escrevia nada no
  // orcamento durante um ano inteiro.
  const monthDate = (year: number, month: number) =>
    new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));

  const agora = new Date("2026-08-25T10:00:00Z");

  it("uma transaccao de um mes futuro fica fora do limite", () => {
    // Dezembro de 2026, com "agora" em Agosto de 2026.
    expect(monthDate(2026, 12).getTime()).toBeGreaterThanOrEqual(
      excelMonthCap(agora).getTime()
    );
  });

  it("a transaccao do mes corrente conta -- e gravada no dia 1 ao meio-dia UTC", () => {
    expect(monthDate(2026, 8).getTime()).toBeLessThan(
      excelMonthCap(agora).getTime()
    );
  });

  it("os meses passados contam todos", () => {
    for (let m = 1; m <= 8; m += 1) {
      expect(monthDate(2026, m).getTime()).toBeLessThan(
        excelMonthCap(agora).getTime()
      );
    }
  });

  it("uma folha com meses futuros nao empurra o corte para alem do mes corrente", () => {
    // O caminho todo: a folha cobre Janeiro a Dezembro de 2026, mas so ate
    // Agosto e que ja aconteceu. O corte tem de ser 2026-09-01, nao 2027-01-01.
    const celulas = Array.from({ length: 12 }, (_, i) => monthDate(2026, i + 1));
    const cap = excelMonthCap(agora);
    const passados = celulas.filter((d) => d.getTime() < cap.getTime());
    const ultimo = passados[passados.length - 1];

    const corte = derivedCutoff({
      year: ultimo.getUTCFullYear(),
      month: ultimo.getUTCMonth() + 1,
    });

    expect(corte).toBe("2026-09-01");
  });

  it("em Dezembro o limite passa para Janeiro do ano seguinte", () => {
    expect(excelMonthCap(new Date("2026-12-20T10:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z"
    );
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
    const plan = reconcilePlan(
      desired.map((d) => ({ externalId: d.externalId, amount: d.amount })),
      desired
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("apaga o que deixou de ser desejado quando o corte avanca", () => {
    // Ja existiam linhas de setembro; uma folha nova passou a cobrir setembro
    // e o corte avancou para outubro.
    const existing = bridgeRows(source, null).map((d) => ({
      externalId: d.externalId,
      amount: d.amount,
    }));
    const plan = reconcilePlan(existing, bridgeRows(source, "2026-10-01"));

    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toHaveLength(existing.length);
    expect(plan.toDelete.every((id) => id.startsWith(BRIDGE_PREFIX))).toBe(true);
  });

  it("nunca apaga uma despesa sem o prefixo, mesmo que o chamador passe a lista toda", () => {
    // Se um dia alguem passar aqui todas as transaccoes em vez de so as da
    // ponte, a funcao tem de se defender sozinha -- nao pode confiar na
    // disciplina de quem a chama.
    const existing = [{ externalId: "manual-1", amount: "9.99" }];
    const plan = reconcilePlan(existing, []);

    expect(plan.toDelete).not.toContain("manual-1");
    expect(plan.toDelete).toEqual([]);
  });

  it("nunca actualiza uma linha sem o prefixo, mesmo com o mesmo identificador", () => {
    const desejado: BridgeRow[] = [
      { ...desired[0], externalId: "manual-1", amount: "1.00" },
    ];
    const plan = reconcilePlan([{ externalId: "manual-1", amount: "9.99" }], desejado);

    expect(plan.toUpdate).toEqual([]);
    // Nao sendo dela, a linha manual nao e reconhecida como existente: o
    // desejado com esse id conta como criacao, que e o comportamento que o
    // prefixo impoe em toda a funcao.
    expect(plan.toCreate).toHaveLength(1);
  });

  it("actualiza o agregado dos juros quando o mes cresce", () => {
    // O unico externalId cujo valor muda depois de existir. Antes do toUpdate,
    // o reconcilePlan via-o como "ja existe" e o mes ficava congelado no valor
    // do primeiro dia em que a ponte correu.
    const antes = bridgeRows(
      { cashflows: [cashflow("i-a", "2026-09-01T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.20")], dividends: [] },
      null
    );
    const agora = bridgeRows(
      {
        cashflows: [
          cashflow("i-a", "2026-09-01T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.20"),
          cashflow("i-b", "2026-09-02T09:00:00Z", "INTEREST_ON_FREE_CASH", "0.21"),
        ],
        dividends: [],
      },
      null
    );

    const plan = reconcilePlan(
      antes.map((r) => ({ externalId: r.externalId, amount: r.amount })),
      agora
    );

    expect(plan.toCreate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]).toMatchObject({
      externalId: `${INTEREST_PREFIX}2026-09`,
      amount: "0.41",
    });
  });

  it("nao actualiza o que nao mudou -- inclusive escrito de outra maneira", () => {
    // "-0.00" e "0.00" sao a mesma quantia. Comparadas como texto davam uma
    // actualizacao a cada corrida, para sempre.
    const plan = reconcilePlan(
      desired.map((d) => ({
        externalId: d.externalId,
        amount: d.amount === "0.00" ? "-0.00" : d.amount,
      })),
      desired
    );
    expect(plan.toUpdate).toEqual([]);
  });
});

describe("runBridge", () => {
  // O trio corte -> plano -> aplicacao tem dois chamadores: a etapa `bridge` do
  // syncAll e o fim do importBudgetWorkbook. E aqui, na funcao partilhada, que
  // se fixa o comportamento -- o import so lhe passa o repositorio real.
  const fakeRepo = (
    over: Partial<BridgeRepo> = {}
  ): BridgeRepo & {
    applyBridge: ReturnType<typeof vi.fn>;
  } => ({
    lastExcelMonth: vi.fn(async () => ({ year: 2026, month: 9 })),
    bridgeSource: vi.fn(async () => source as never),
    existingBridgeRows: vi.fn(
      async () => [] as { externalId: string; amount: string }[]
    ),
    applyBridge: vi.fn(
      async (
        _userId: string,
        _plan: { toDelete: string[]; toCreate: BridgeRow[]; toUpdate: BridgeRow[] }
      ) => ({ created: 0, deleted: 0, updated: 0 })
    ),
    ...over,
  } as BridgeRepo & { applyBridge: ReturnType<typeof vi.fn> });

  it("sem corte explicito deriva-o do ultimo mes do Excel", async () => {
    // O Excel cobre ate Setembro de 2026, portanto o corte e 2026-10-01 e nada
    // de Setembro atravessa.
    const repo = fakeRepo();
    await runBridge("u1", repo, null);

    const plan = repo.applyBridge.mock.calls[0][1] as { toCreate: BridgeRow[] };
    expect(plan.toCreate).toEqual([]);
  });

  it("o corte explicito do .env ganha ao derivado", async () => {
    const repo = fakeRepo();
    await runBridge("u1", repo, "2026-09-13");

    const plan = repo.applyBridge.mock.calls[0][1] as { toCreate: BridgeRow[] };
    expect(plan.toCreate.map((r) => r.externalId)).toEqual([
      `${INTEREST_PREFIX}2026-09`,
      `${BRIDGE_PREFIX}div-1`,
    ]);
  });

  it("um corte que avancou apaga o que a ponte tinha criado nesse mes", async () => {
    // Este e o caso que motiva correr o trio tambem no fim do import da folha:
    // a folha passou a cobrir Setembro, e as linhas que a ponte criou para
    // Setembro passam a estar representadas duas vezes na grelha.
    const jaCriadas = bridgeRows(source, null).map((r) => ({
      externalId: r.externalId,
      amount: r.amount,
    }));
    const repo = fakeRepo({
      existingBridgeRows: vi.fn(async () => jaCriadas),
      applyBridge: vi.fn(async () => ({
        created: 0,
        deleted: jaCriadas.length,
        updated: 0,
      })),
    });

    const applied = await runBridge("u1", repo, null);

    const plan = repo.applyBridge.mock.calls[0][1] as { toDelete: string[] };
    expect(plan.toDelete).toHaveLength(jaCriadas.length);
    expect(applied.deleted).toBe(jaCriadas.length);
  });

  it("devolve o que o repositorio aplicou, para o relatorio poder mostra-lo", async () => {
    const repo = fakeRepo({
      applyBridge: vi.fn(async () => ({ created: 3, deleted: 7, updated: 2 })),
    });

    expect(await runBridge("u1", repo, null)).toEqual({
      created: 3,
      deleted: 7,
      updated: 2,
    });
  });
});
