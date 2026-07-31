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
    expect(others).toHaveLength(3);
    expect(others.map((o) => `${o.section}/${o.group}`).sort()).toEqual([
      "expenses/Personal and Family",
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

  it("extrai os totais que a folha declara, para servirem de referencia", () => {
    expect(parsed.checksums.sections.income).toBeCloseTo(1363.91, 2);
    expect(parsed.checksums.sections.savings).toBeCloseTo(200, 2);
    expect(parsed.checksums.sections.expenses).toBeCloseTo(149.78, 2);
    expect(parsed.checksums.groups["expenses/Home"]).toBeCloseTo(0, 2);
    expect(
      parsed.checksums.groups["expenses/Personal and Family"]
    ).toBeCloseTo(149.78, 2);
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
