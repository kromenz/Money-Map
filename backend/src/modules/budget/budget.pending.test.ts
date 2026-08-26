import { describe, it, expect } from "vitest";
import { pendingBodySchema, clearBodySchema } from "./budget.schemas";
import { toPendingResponse } from "./budget.pending";
import { Prisma } from "@prisma/client";

describe("pendingBodySchema", () => {
  const valid = {
    year: 2026,
    month: 8,
    section: "expenses",
    group: "Home",
    name: "Groceries",
    amount: "12.50",
  };

  it("aceita um corpo valido", () => {
    expect(pendingBodySchema.safeParse(valid).success).toBe(true);
  });

  it("aceita um grupo vazio -- ha categorias fora de qualquer grupo", () => {
    expect(
      pendingBodySchema.safeParse({ ...valid, group: "" }).success
    ).toBe(true);
  });

  it("recusa um mes fora da gama", () => {
    expect(pendingBodySchema.safeParse({ ...valid, month: 0 }).success).toBe(false);
    expect(pendingBodySchema.safeParse({ ...valid, month: 13 }).success).toBe(false);
  });

  it("recusa uma seccao desconhecida", () => {
    expect(
      pendingBodySchema.safeParse({ ...valid, section: "outra" }).success
    ).toBe(false);
  });

  it("recusa um valor de zero ou negativo", () => {
    expect(pendingBodySchema.safeParse({ ...valid, amount: "0" }).success).toBe(false);
    expect(pendingBodySchema.safeParse({ ...valid, amount: "-5" }).success).toBe(false);
  });

  it("recusa um valor que nao e um numero", () => {
    expect(pendingBodySchema.safeParse({ ...valid, amount: "abc" }).success).toBe(false);
  });

  it("recusa um nome vazio", () => {
    expect(pendingBodySchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });
});

describe("clearBodySchema", () => {
  it("aceita uma lista de ids", () => {
    expect(clearBodySchema.safeParse({ ids: ["a", "b"] }).success).toBe(true);
  });

  it("aceita uma lista vazia -- nada a limpar nao e erro", () => {
    expect(clearBodySchema.safeParse({ ids: [] }).success).toBe(true);
  });

  it("recusa ids que nao sejam strings", () => {
    expect(clearBodySchema.safeParse({ ids: [1] }).success).toBe(false);
  });
});

describe("toPendingResponse", () => {
  it("devolve o valor em string, como o resto do dinheiro na API", () => {
    const row = {
      id: "abc",
      year: 2026,
      month: 8,
      section: "expenses",
      group: "Home",
      name: "Groceries",
      amount: new Prisma.Decimal("12.5"),
      note: "Continente",
    };

    expect(toPendingResponse([row])).toEqual([
      {
        id: "abc",
        year: 2026,
        month: 8,
        section: "expenses",
        group: "Home",
        name: "Groceries",
        amount: "12.50",
        // A etiqueta atravessa a fila: sem ela, um gasto registado com o Excel
        // aberto chegava a folha sem nome.
        note: "Continente",
      },
    ]);
  });
});
