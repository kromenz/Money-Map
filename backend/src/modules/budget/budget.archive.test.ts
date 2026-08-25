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
