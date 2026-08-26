import { describe, it, expect, vi, beforeEach } from "vitest";

// applyBridge fala Prisma directamente -- o SyncRepo injectado em t212.sync.ts
// nunca chega aqui, por isso estas duas invariantes (I1: categorias resolvidas
// uma vez fora do ciclo; I2: apagar limitado ao prefixo da ponte) so se
// verificam com um duplo do proprio cliente Prisma, ao estilo do
// auth.middleware.test.ts.
vi.mock("../../db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    category: { upsert: vi.fn() },
    transaction: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

import { prisma } from "../../db/prisma";
import { prismaRepo } from "./t212.repo";
import { BRIDGE_PREFIX, CATEGORIES, type BridgeRow } from "./t212.bridge";

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  category: { upsert: ReturnType<typeof vi.fn> };
  transaction: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

function row(overrides: Partial<BridgeRow> = {}): BridgeRow {
  return {
    externalId: "t212:x",
    date: "2026-04-10",
    amount: "10.00",
    section: CATEGORIES.transfers.section,
    group: CATEGORIES.transfers.group,
    name: CATEGORIES.transfers.name,
    merchant: "Trading 212",
    rawDescription: "T212 DEPOSIT",
    ...overrides,
  };
}

beforeEach(() => {
  mockPrisma.$transaction.mockReset();
  mockPrisma.category.upsert.mockReset();
  mockPrisma.transaction.deleteMany.mockReset();
  mockPrisma.transaction.createMany.mockReset();

  // O "tx" que a implementacao recebe tem a mesma forma que o prisma
  // mockado -- e o suficiente para exercitar o corpo da transaccao.
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown, opts?: unknown) => {
    capturedTxOptions = opts;
    return fn(mockPrisma);
  });
  mockPrisma.category.upsert.mockImplementation(async (args: any) => ({
    id: `cat:${args.where.userId_section_group_name.name}`,
  }));
  mockPrisma.transaction.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.transaction.createMany.mockImplementation(async (args: any) => ({
    count: args.data.length,
  }));
});

let capturedTxOptions: unknown;

describe("prismaRepo.applyBridge", () => {
  it("resolve cada categoria distinta uma so vez, fora do ciclo, e grava as linhas com createMany", async () => {
    // Cinco linhas, tres categorias distintas -- exactamente o cenario da
    // primeira ponte a seguir a um backfill de anos: centenas de linhas,
    // poucas categorias. Antes, cada linha resolvia a sua categoria dentro do
    // ciclo (uma ida a mais a base por linha), o que multiplicava as idas
    // sequenciais contra o limite de 5s da transaccao interactiva.
    const toCreate: BridgeRow[] = [
      row({ externalId: "t212:1", ...CATEGORIES.dividends }),
      row({ externalId: "t212:2", ...CATEGORIES.dividends }),
      row({ externalId: "t212:3" }), // transfers, por omissao do helper
      row({ externalId: "t212:4" }), // transfers
      row({ externalId: "t212:5", ...CATEGORIES.interest }),
    ];

    const result = await prismaRepo.applyBridge("u1", { toDelete: [], toCreate, toUpdate: [] });

    expect(mockPrisma.category.upsert).toHaveBeenCalledTimes(3);
    expect(mockPrisma.transaction.createMany).toHaveBeenCalledTimes(1);

    const data = mockPrisma.transaction.createMany.mock.calls[0][0].data as {
      externalId: string;
      categoryId: string;
    }[];
    expect(data).toHaveLength(5);

    const byId = Object.fromEntries(data.map((d) => [d.externalId, d.categoryId]));
    expect(byId["t212:1"]).toBe(`cat:${CATEGORIES.dividends.name}`);
    expect(byId["t212:3"]).toBe(`cat:${CATEGORIES.transfers.name}`);
    expect(byId["t212:5"]).toBe(`cat:${CATEGORIES.interest.name}`);
    expect(result.created).toBe(5);
  });

  it("passa um timeout explicito a transaccao interactiva, em vez de confiar no omisso de 5s", async () => {
    await prismaRepo.applyBridge("u1", { toDelete: [], toCreate: [row()], toUpdate: [] });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(capturedTxOptions).toEqual(
      expect.objectContaining({ timeout: expect.any(Number) })
    );
    expect((capturedTxOptions as { timeout: number }).timeout).toBeGreaterThan(5_000);
  });

  it("o apagar fica limitado ao prefixo da ponte mesmo que source seja generico", async () => {
    // reconcilePlan ja filtra o existing pelo prefixo antes de chegar aqui,
    // mas o proprio apagar nao pode depender da disciplina de quem chama --
    // e a mesma decisao ja tomada dentro do reconcilePlan.
    await prismaRepo.applyBridge("u1", {
      toDelete: ["t212:a", "t212:b"],
      toCreate: [],
      toUpdate: [],
    });

    expect(mockPrisma.transaction.deleteMany).toHaveBeenCalledTimes(1);
    const where = mockPrisma.transaction.deleteMany.mock.calls[0][0].where;
    expect(where.externalId).toEqual(
      expect.objectContaining({ in: ["t212:a", "t212:b"], startsWith: BRIDGE_PREFIX })
    );
  });
});
