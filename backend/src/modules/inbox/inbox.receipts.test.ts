import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Como no budget.notes.query.test.ts: verifica-se a forma do pedido a Prisma.
vi.mock("../../db/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    pendingExpense: { create: vi.fn((args) => ({ op: "pending", args })) },
    inboxReceipt: {
      create: vi.fn((args) => ({ op: "receipt", args })),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../../db/prisma";
import { alreadyReceived, receiverFor } from "./inbox.receipts";

const mock = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  inboxReceipt: { count: ReturnType<typeof vi.fn> };
};

const input = {
  year: 2026,
  month: 10,
  section: "expenses" as const,
  group: "Casa",
  name: "Supermercado",
  amount: "2.50",
  note: "Continente",
};

beforeEach(() => {
  mock.$transaction.mockReset();
  mock.inboxReceipt.count.mockReset();
});

describe("receiverFor", () => {
  it("cria a pendente e o recibo na mesma transaccao", async () => {
    mock.$transaction.mockResolvedValue([]);

    await receiverFor("u1")("src-1", input);

    const ops = mock.$transaction.mock.calls[0][0];
    expect(ops.map((o: { op: string }) => o.op)).toEqual(["pending", "receipt"]);
    expect(ops[0].args.data).toMatchObject({
      userId: "u1",
      year: 2026,
      month: 10,
      name: "Supermercado",
      note: "Continente",
    });
    expect(ops[0].args.data.amount.toFixed(2)).toBe("2.50");
    expect(ops[1].args.data).toEqual({ userId: "u1", sourceId: "src-1" });
  });

  it("um recibo que ja existe nao e erro", async () => {
    // Duas corridas no mesmo id: a transaccao inteira reverte, por isso a
    // pendente tambem nao fica duplicada.
    mock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicado", { code: "P2002", clientVersion: "6" })
    );
    await expect(receiverFor("u1")("src-1", input)).resolves.toBeUndefined();
  });

  it("qualquer outro erro sobe", async () => {
    mock.$transaction.mockRejectedValue(new Error("base em baixo"));
    await expect(receiverFor("u1")("src-1", input)).rejects.toThrow("base em baixo");
  });
});

describe("alreadyReceived", () => {
  it("diz se o recibo existe", async () => {
    mock.inboxReceipt.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect(await alreadyReceived("a")).toBe(true);
    expect(await alreadyReceived("b")).toBe(false);
    expect(mock.inboxReceipt.count.mock.calls[0][0]).toEqual({ where: { sourceId: "a" } });
  });
});
