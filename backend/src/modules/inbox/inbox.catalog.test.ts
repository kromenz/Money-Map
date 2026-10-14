import { describe, it, expect, vi } from "vitest";

vi.mock("../../db/prisma", () => ({
  prisma: {
    category: {
      findMany: vi.fn(async () => [
        { section: "expenses", group: "Casa", name: "Supermercado", sortOrder: 3 },
      ]),
    },
  },
}));
vi.mock("../budget/budget.notes.query", () => ({
  getNoteSuggestions: vi.fn(async () => [{ note: "Continente", uses: 41 }]),
}));

import { prisma } from "../../db/prisma";
import { buildCatalog } from "./inbox.catalog";

describe("buildCatalog", () => {
  it("junta as categorias activas e as notas", async () => {
    const catalog = await buildCatalog("u1", () => new Date("2026-10-14T18:30:00.000Z"));

    expect(catalog).toEqual({
      categories: [{ section: "expenses", group: "Casa", name: "Supermercado", sortOrder: 3 }],
      notes: [{ note: "Continente", uses: 41 }],
      builtAt: "2026-10-14T18:30:00.000Z",
    });
  });

  it("so as categorias deste utilizador e nao arquivadas", async () => {
    await buildCatalog("u1");
    const call = (prisma.category.findMany as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // As arquivadas sao as que a folha ja nao tem: oferece-las no telemovel
    // era criar gastos que o flush rejeita.
    expect(call.where).toEqual({ userId: "u1", archived: false });
  });
});
