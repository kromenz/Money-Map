import { describe, it, expect, beforeAll } from "vitest";
import { buildFixtureWorkbook } from "./budget.fixture";
import { parseBudgetWorkbook, signedAmount } from "./budget.parser";
import type { ParsedWorkbook } from "./budget.parser";

describe("parseBudgetWorkbook", () => {
  let parsed: ParsedWorkbook;

  beforeAll(async () => {
    parsed = await parseBudgetWorkbook(await buildFixtureWorkbook(), 2026);
  });

  it("le o valor cacheado das celulas que sao formulas", () => {
    const tec = parsed.cells.find(
      (c) => c.name === "Tecnology" && c.month === 1
    );
    expect(tec?.sheetValue).toBeCloseTo(109.24, 2);
  });

  it("preserva o reembolso ja netado pela folha", () => {
    const temu = parsed.cells.find((c) => c.name === "Temu" && c.month === 1);
    expect(temu?.sheetValue).toBeCloseTo(12.17, 2);
  });

  it("preserva os negativos dentro da seccao income", () => {
    const irs = parsed.cells.find((c) => c.name === "IRS" && c.month === 1);
    expect(irs?.section).toBe("income");
    expect(irs?.sheetValue).toBeCloseTo(-100, 2);
  });

  it("nao cria celulas para valores a zero nem para meses vazios", () => {
    expect(parsed.cells.some((c) => c.sheetValue === 0)).toBe(false);
    expect(parsed.cells.some((c) => c.name === "Mortgage / Rent")).toBe(false);
  });

  it("cria a categoria mesmo quando ela nao tem dados em mes nenhum", () => {
    expect(
      parsed.categories.some(
        (c) => c.name === "Mortgage / Rent" && c.group === "Home"
      )
    ).toBe(true);
    expect(
      parsed.categories.some(
        (c) => c.name === "Real Vida" && c.section === "income"
      )
    ).toBe(true);
  });

  it("distingue as varias categorias chamadas Other", () => {
    const others = parsed.categories.filter((c) => c.name === "Other");
    expect(others.map((o) => `${o.section}/${o.group}`).sort()).toEqual([
      "expenses/Other",
      "income/",
      "savings/",
    ]);
  });

  it("nao confunde um cabecalho de grupo com uma categoria", () => {
    expect(parsed.categories.some((c) => c.name === "Home")).toBe(false);
    expect(parsed.categories.some((c) => c.name === "Personal and Family")).toBe(
      false
    );
    expect(parsed.categories.some((c) => c.name === "Monthly Totals")).toBe(
      false
    );
  });

  it("extrai os totais mensais que a folha declara", () => {
    expect(parsed.checksums.sections.income.months[0]).toBeCloseTo(1104.7, 2);
    expect(parsed.checksums.sections.income.months[1]).toBeCloseTo(259.21, 2);
    expect(parsed.checksums.sections.savings.months[1]).toBeCloseTo(200, 2);
    expect(
      parsed.checksums.groups["expenses/Personal and Family"].months[0]
    ).toBeCloseTo(129.78, 2);
    expect(
      parsed.checksums.groups["expenses/Other"].months[0]
    ).toBeCloseTo(5, 2);
  });

  it("deixa a null os meses cuja formula nao tem valor em cache", () => {
    // O subtotal do grupo Home e todo a zeros, portanto o Excel nao guarda
    // cache. Nao pode virar 0 -- tem de ficar por comparar.
    const home = parsed.checksums.groups["expenses/Home"];
    expect(home).toBeUndefined();
  });

  it("le uma categoria a zeros como categoria, nao como cabecalho de grupo", () => {
    expect(
      parsed.categories.some(
        (c) => c.name === "Real Vida" && c.section === "income" && c.group === ""
      )
    ).toBe(true);
  });

  it("nao contamina o grupo das categorias seguintes", () => {
    const duo = parsed.categories.find((c) => c.name === "Other" && c.section === "income");
    expect(duo?.group).toBe("");
  });

  it("reconhece um cabecalho de grupo sem o rotulo Annually", () => {
    expect(parsed.categories.some((c) => c.name === "Personal and Family")).toBe(false);
    expect(
      parsed.categories.some(
        (c) => c.name === "Tecnology" && c.group === "Personal and Family"
      )
    ).toBe(true);
  });

  it("distingue o grupo Other das categorias chamadas Other", () => {
    expect(parsed.categories.some((c) => c.name === "Other" && c.group === "Other")).toBe(true);
    expect(
      parsed.categories.some(
        (c) => c.name === "Miscellaneous Expenses" && c.group === "Other"
      )
    ).toBe(true);
  });

  it("ignora a cache obsoleta do total anual", () => {
    // Gym tem cache anual de 999 e meses que somam 8.37. O anual nao e lido.
    const gym = parsed.cells.filter((c) => c.name === "Gym");
    expect(gym).toHaveLength(1);
    expect(gym[0].sheetValue).toBeCloseTo(8.37, 2);
  });

  it("nao le uma linha em branco dentro de um grupo como subtotal", () => {
    expect(
      parsed.checksums.groups["expenses/Personal and Family"].months[0]
    ).toBeCloseTo(129.78, 2);
  });
});

describe("signedAmount", () => {
  it("mantem o sinal da folha nas receitas", () => {
    expect(signedAmount("income", 1150)).toBe(1150);
    expect(signedAmount("income", -100)).toBe(-100);
  });

  it("inverte o sinal nas despesas e nas poupancas", () => {
    expect(signedAmount("expenses", 109.24)).toBe(-109.24);
    expect(signedAmount("savings", 200)).toBe(-200);
  });
});
