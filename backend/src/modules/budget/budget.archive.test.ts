import { describe, it, expect } from "vitest";
import { planArchive } from "./budget.archive";

const cat = (
  id: string,
  group: string,
  name: string,
  archived = false,
  section = "expenses"
) => ({ id, section, group, name, archived });

describe("planArchive", () => {
  it("arquiva o que a folha ja nao tem e nunca foi usado", () => {
    // O caso verdadeiro: 11 categorias com grupos que nunca existiram
    // ("Car Payments", "Prescriptions"), nascidas de uma leitura antiga do
    // parser e sem uma unica transaccao.
    const existing = [
      cat("1", "Transportation", "Fuel / Gasoline"),
      cat("velha", "Car Payments", "Fuel / Gasoline"),
    ];
    const sheet = [{ section: "expenses", group: "Transportation", name: "Fuel / Gasoline" }];

    const plan = planArchive(existing, sheet, new Set());

    expect(plan.toArchive).toEqual(["velha"]);
  });

  it("nunca arquiva o que tem historico, mesmo fora da folha deste ano", () => {
    // A importacao e por ano. Uma categoria so de 2025 esta legitimamente
    // ausente da folha de 2026, e arquiva-la escondia um ano de historico.
    const existing = [cat("so-2025", "Home", "Mudanca")];
    const plan = planArchive(existing, [], new Set(["so-2025"]));

    expect(plan.toArchive).toEqual([]);
  });

  it("nao volta a arquivar o que ja esta arquivado", () => {
    const existing = [cat("velha", "Car Payments", "Other", true)];
    const plan = planArchive(existing, [], new Set());

    expect(plan.toArchive).toEqual([]);
  });

  it("uma categoria que reaparece na folha volta a estar activa", () => {
    const existing = [cat("volta", "Home", "Property Taxes", true)];
    const sheet = [{ section: "expenses", group: "Home", name: "Property Taxes" }];

    expect(planArchive(existing, sheet, new Set()).toRestore).toEqual(["volta"]);
  });

  it("a chave inclui a seccao -- o mesmo nome em income e expenses e outra coisa", () => {
    const existing = [cat("i", "", "Other", false, "income")];
    const sheet = [{ section: "expenses", group: "", name: "Other" }];

    expect(planArchive(existing, sheet, new Set()).toArchive).toEqual(["i"]);
  });

  it("o grupo faz parte da chave -- e o que distingue as intrusas", () => {
    // "Transportation/Other" e "Car Payments/Other" tem o mesmo nome e sao
    // categorias diferentes. Sem o grupo na chave, a intrusa passava por boa.
    const existing = [
      cat("boa", "Transportation", "Other"),
      cat("intrusa", "Car Payments", "Other"),
    ];
    const sheet = [{ section: "expenses", group: "Transportation", name: "Other" }];

    const plan = planArchive(existing, sheet, new Set());
    expect(plan.toArchive).toEqual(["intrusa"]);
  });

  it("sem nada em base nao ha nada a fazer", () => {
    expect(planArchive([], [], new Set())).toEqual({ toArchive: [], toRestore: [] });
  });
});

describe("planArchive, a terceira condicao (o grupo tem de ser desconhecido)", () => {
  it("nao arquiva uma categoria nova cujo grupo a folha tem", () => {
    // O caso verdadeiro que quase deu asneira: o utilizador criou `Dividends`
    // e `Interest` na folha de 2026. Estao ausentes da de 2025 e ainda sem
    // transaccoes, porque a ponte so comeca a escrever em Setembro. Com so as
    // duas primeiras condicoes, importar 2025 arquivava-as -- e o resultado
    // final dependia da ordem por que as folhas fossem importadas.
    const existing = [cat("nova", "", "Dividends", false, "income")];
    // A folha de 2025 tem outras categorias de income, todas sem grupo.
    const folha2025 = [{ section: "income", group: "", name: "Salario" }];

    expect(planArchive(existing, folha2025, new Set()).toArchive).toEqual([]);
  });

  it("arquiva quando o grupo e ele proprio desconhecido da folha", () => {
    // A assinatura das intrusas: "Car Payments" e uma categoria noutro sitio e
    // nunca foi um grupo, portanto nenhuma folha o vai reclamar.
    const existing = [cat("intrusa", "Car Payments", "Fuel / Gasoline")];
    const folha = [{ section: "expenses", group: "Transportation", name: "Fuel / Gasoline" }];

    expect(planArchive(existing, folha, new Set()).toArchive).toEqual(["intrusa"]);
  });

  it("o grupo conta por seccao -- o mesmo nome em income e expenses e outro grupo", () => {
    const existing = [cat("x", "Other", "Coisa", false, "income")];
    // "Other" existe como grupo, mas em expenses.
    const folha = [{ section: "expenses", group: "Other", name: "Miscellaneous" }];

    expect(planArchive(existing, folha, new Set()).toArchive).toEqual(["x"]);
  });

  it("um grupo inteiro apagado da folha fica por arquivar -- o lado seguro de errar", () => {
    // Deixa a categoria a vista em vez de a esconder. Se o utilizador apagou o
    // grupo de proposito, ve-o na grelha e decide; se foi engano, nao perdeu
    // nada.
    const existing = [cat("orfa", "Grupo Que Desapareceu", "Coisa")];
    const folha = [{ section: "expenses", group: "Home", name: "Rent" }];

    expect(planArchive(existing, folha, new Set()).toArchive).toEqual(["orfa"]);
  });
});
