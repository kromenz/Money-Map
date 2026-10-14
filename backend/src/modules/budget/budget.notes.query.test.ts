import { describe, it, expect, vi, beforeEach } from "vitest";

// Como no budget.parcels.query.test.ts: a query fala Prisma directamente, e o
// que aqui se verifica e a forma do pedido e a traducao da resposta.
vi.mock("../../db/prisma", () => ({
  prisma: { sheetParcel: { groupBy: vi.fn() } },
}));

import { prisma } from "../../db/prisma";
import { getNoteSuggestions, NOTE_LIMIT } from "./budget.notes.query";

const mockPrisma = prisma as unknown as {
  sheetParcel: { groupBy: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  mockPrisma.sheetParcel.groupBy.mockReset();
  mockPrisma.sheetParcel.groupBy.mockResolvedValue([]);
});

describe("getNoteSuggestions", () => {
  it("pede so as etiquetas deste utilizador, e so as que existem", async () => {
    await getNoteSuggestions("u1");

    const call = mockPrisma.sheetParcel.groupBy.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "u1", note: { not: null } });
    // Sem filtro de seccao: uma etiqueta escrita numa linha de income e na
    // mesma uma etiqueta que o utilizador ja usou, e a barra escreve nas tres.
    expect(call.where.category).toBeUndefined();
  });

  it("traz as mais usadas primeiro, com tecto", async () => {
    await getNoteSuggestions("u1");

    const call = mockPrisma.sheetParcel.groupBy.mock.calls[0][0];
    expect(call.take).toBe(NOTE_LIMIT);
    // Desempate pelo texto: sem ele duas etiquetas com o mesmo numero de usos
    // trocavam de lugar entre pedidos e a lista dancava debaixo do rato.
    expect(call.orderBy).toEqual([
      { _count: { note: "desc" } },
      { note: "asc" },
    ]);
  });

  it("devolve o texto e quantas vezes foi usado", async () => {
    mockPrisma.sheetParcel.groupBy.mockResolvedValue([
      { note: "Buenissima", _count: { note: 4 } },
      { note: "Amazon", _count: { note: 1 } },
    ]);

    expect(await getNoteSuggestions("u1")).toEqual([
      { note: "Buenissima", uses: 4 },
      { note: "Amazon", uses: 1 },
    ]);
  });

  it("nao deixa passar um nulo se o agrupamento devolver um", async () => {
    // O `note: { not: null }` ja o exclui; isto e a segunda tranca, para uma
    // etiqueta vazia nunca chegar a lista de sugestoes como uma linha em
    // branco onde nao se percebe no que se esta a carregar.
    mockPrisma.sheetParcel.groupBy.mockResolvedValue([
      { note: null, _count: { note: 9 } },
      { note: "Amazon", _count: { note: 1 } },
    ]);

    expect(await getNoteSuggestions("u1")).toEqual([{ note: "Amazon", uses: 1 }]);
  });
});
