import { describe, it, expect } from "vitest";
import { inboxEntrySchema, toPendingInput } from "./inbox.entry";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "5b1d2c3e-4f50-4a61-8b72-9c8d7e6f5a40",
  date: "2026-10-14",
  section: "expenses",
  group: "Casa",
  name: "Supermercado",
  amount: "2.50",
  note: "Continente",
  createdAt: "2026-10-14T18:22:05.120Z",
  ...over,
});

describe("inboxEntrySchema", () => {
  it("aceita uma entrada normal", () => {
    expect(inboxEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it("aceita sem nota e com grupo vazio", () => {
    expect(inboxEntrySchema.safeParse(entry({ note: undefined, group: "" })).success).toBe(true);
  });

  it("recusa datas que nao existem", () => {
    for (const date of ["2026-02-30", "2026-13-01", "2026-00-10", "14/10/2026", "2026-1-5"]) {
      expect(inboxEntrySchema.safeParse(entry({ date })).success, date).toBe(false);
    }
  });

  it("recusa anos fora da gama da folha", () => {
    expect(inboxEntrySchema.safeParse(entry({ date: "1999-12-31" })).success).toBe(false);
    expect(inboxEntrySchema.safeParse(entry({ date: "2101-01-01" })).success).toBe(false);
  });

  it("o valor e decimal com ponto e no maximo 2 casas, maior que zero", () => {
    for (const amount of ["2,50", "2.505", "-1", "0", "0.00", "abc", "1e3", " 2.50"]) {
      expect(inboxEntrySchema.safeParse(entry({ amount })).success, amount).toBe(false);
    }
    for (const amount of ["2", "2.5", "2.50", "1234.99"]) {
      expect(inboxEntrySchema.safeParse(entry({ amount })).success, amount).toBe(true);
    }
  });

  it("recusa seccao desconhecida, nome vazio e nota longa", () => {
    expect(inboxEntrySchema.safeParse(entry({ section: "other" })).success).toBe(false);
    expect(inboxEntrySchema.safeParse(entry({ name: "" })).success).toBe(false);
    expect(inboxEntrySchema.safeParse(entry({ note: "x".repeat(61) })).success).toBe(false);
  });

  it("o valor cabe no Decimal(12,2) da base", () => {
    // Um valor que o Zod aceitasse e o Postgres recusasse voltava sempre
    // primeiro na caixa e travava tudo o que viesse depois dele.
    expect(inboxEntrySchema.safeParse(entry({ amount: "12345678901" })).success).toBe(false);
    expect(inboxEntrySchema.safeParse(entry({ amount: "9999999999.99" })).success).toBe(true);
  });

  it("recusa caracteres de controlo no texto", () => {
    // O Postgres recusa \u0000 em TEXT, e o XML da folha recusa os outros.
    for (const field of ["name", "group", "note"]) {
      expect(inboxEntrySchema.safeParse(entry({ [field]: "Su\u0000per" })).success, field).toBe(false);
      expect(inboxEntrySchema.safeParse(entry({ [field]: "Su\u0007per" })).success, field).toBe(false);
    }
  });

  it("recusa nomes de categoria absurdamente longos", () => {
    expect(inboxEntrySchema.safeParse(entry({ name: "x".repeat(201) })).success).toBe(false);
    expect(inboxEntrySchema.safeParse(entry({ group: "x".repeat(201) })).success).toBe(false);
  });

  it("recusa um id que nao e UUID", () => {
    expect(inboxEntrySchema.safeParse(entry({ id: "1" })).success).toBe(false);
  });
});

describe("toPendingInput", () => {
  it("a data passa a ano e mes, lida como calendario", () => {
    // Nunca via Date: "2026-11-01" lido como instante UTC e mostrado noutro
    // fuso podia virar 31 de Outubro. O telemovel ja a escreveu em hora local.
    const p = toPendingInput(inboxEntrySchema.parse(entry({ date: "2026-11-01" })));
    expect(p).toMatchObject({ year: 2026, month: 11 });
  });

  it("os limites do ano", () => {
    expect(toPendingInput(inboxEntrySchema.parse(entry({ date: "2026-01-01" })))).toMatchObject({ month: 1 });
    expect(toPendingInput(inboxEntrySchema.parse(entry({ date: "2026-12-31" })))).toMatchObject({ month: 12 });
  });

  it("leva categoria, valor e nota tal como vieram", () => {
    expect(toPendingInput(inboxEntrySchema.parse(entry()))).toEqual({
      year: 2026,
      month: 10,
      section: "expenses",
      group: "Casa",
      name: "Supermercado",
      amount: "2.50",
      note: "Continente",
    });
  });

  it("uma nota so de espacos e sem nota", () => {
    expect(toPendingInput(inboxEntrySchema.parse(entry({ note: "   " }))).note).toBeUndefined();
  });
});
