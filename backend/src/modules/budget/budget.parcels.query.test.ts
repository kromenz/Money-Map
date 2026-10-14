import { describe, it, expect, vi, beforeEach } from "vitest";

// A query fala Prisma directamente; o que aqui se verifica e a forma do pedido
// -- e no `where` que a seccao tem de ser cortada, e nao depois, para nao
// trazer da base linhas que nunca vao ser mostradas.
vi.mock("../../db/prisma", () => ({
  prisma: { sheetParcel: { findMany: vi.fn() } },
}));

import { prisma } from "../../db/prisma";
import { getMonthParcels } from "./budget.parcels.query";

const mockPrisma = prisma as unknown as {
  sheetParcel: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  mockPrisma.sheetParcel.findMany.mockReset();
  mockPrisma.sheetParcel.findMany.mockResolvedValue([]);
});

describe("getMonthParcels", () => {
  it("pede so as despesas -- o salario nao foi comprado", async () => {
    await getMonthParcels("u1", 2026, 8);

    const { where } = mockPrisma.sheetParcel.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      userId: "u1",
      year: 2026,
      month: 8,
      category: { section: "expenses" },
    });
  });
});
