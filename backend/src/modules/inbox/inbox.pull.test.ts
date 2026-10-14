import { describe, it, expect } from "vitest";
import { importKey, seal } from "./inbox.crypto";
import { pullInbox, type InboxItem, type PullDeps } from "./inbox.pull";
import type { PendingInput } from "./inbox.entry";

const ID_A = "5b1d2c3e-4f50-4a61-8b72-9c8d7e6f5a40";
const ID_B = "6c2e3d4f-5061-4b72-9c83-0d9e8f7a6b51";

const entry = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  date: "2026-10-14",
  section: "expenses",
  group: "Casa",
  name: "Supermercado",
  amount: "2.50",
  createdAt: "2026-10-14T18:22:05.120Z",
  ...over,
});

/** Uma caixa e uma base em memoria, com o comportamento real que interessa. */
async function world() {
  const key = await importKey(new Uint8Array(32).fill(3));
  const cloud = new Map<string, string>();
  const receipts = new Set<string>();
  const queue: { sourceId: string; input: PendingInput }[] = [];
  let failRemove = false;

  const deps: PullDeps = {
    key,
    list: async (): Promise<InboxItem[]> => [...cloud].map(([id, blob]) => ({ id, blob })),
    remove: async (id) => {
      if (failRemove) throw new Error("rede em baixo");
      cloud.delete(id);
    },
    alreadyReceived: async (id) => receipts.has(id),
    receive: async (sourceId, input) => {
      receipts.add(sourceId);
      queue.push({ sourceId, input });
    },
  };

  return {
    deps,
    cloud,
    queue,
    put: async (id: string, value: unknown, aad = id) => {
      cloud.set(id, await seal(key, value, aad));
    },
    failRemoves: (v: boolean) => {
      failRemove = v;
    },
  };
}

describe("pullInbox", () => {
  it("poe na fila e apaga da cloud", async () => {
    const w = await world();
    await w.put(ID_A, entry(ID_A));

    const report = await pullInbox(w.deps);

    expect(report).toEqual({ received: 1, failures: [] });
    expect(w.queue).toHaveLength(1);
    expect(w.queue[0].input).toMatchObject({ year: 2026, month: 10, amount: "2.50" });
    expect(w.cloud.size).toBe(0);
  });

  it("um DELETE falhado nao duplica no pull seguinte", async () => {
    const w = await world();
    await w.put(ID_A, entry(ID_A));
    w.failRemoves(true);

    expect((await pullInbox(w.deps)).received).toBe(1);
    expect(w.cloud.size).toBe(1);

    w.failRemoves(false);
    const second = await pullInbox(w.deps);

    expect(second.received).toBe(0);
    expect(w.queue).toHaveLength(1);
    // O recibo nao so impede o duplicado: deixa a cloud ser limpa.
    expect(w.cloud.size).toBe(0);
  });

  it("uma entrada que nao decifra fica na cloud e e falha", async () => {
    // O telemovel tem a chave antiga.
    const w = await world();
    const otherKey = await importKey(new Uint8Array(32).fill(9));
    w.cloud.set(ID_A, await seal(otherKey, entry(ID_A), ID_A));

    const report = await pullInbox(w.deps);

    expect(report.received).toBe(0);
    expect(report.failures).toEqual([{ id: ID_A, reason: expect.stringContaining("decrypt") }]);
    expect(w.cloud.has(ID_A)).toBe(true);
    expect(w.queue).toHaveLength(0);
  });

  it("um blob copiado para outro id e falha, nao um gasto", async () => {
    const w = await world();
    await w.put(ID_B, entry(ID_A), ID_A);

    const report = await pullInbox(w.deps);

    expect(report.failures.map((f) => f.id)).toEqual([ID_B]);
    expect(w.queue).toHaveLength(0);
  });

  it("uma entrada invalida fica na cloud e e falha", async () => {
    const w = await world();
    await w.put(ID_A, entry(ID_A, { date: "2026-02-30" }));
    await w.put(ID_B, entry(ID_B, { amount: "2,50" }));

    const report = await pullInbox(w.deps);

    expect(report.received).toBe(0);
    expect(report.failures).toHaveLength(2);
    expect(report.failures[0].reason).toContain("not valid");
    expect(w.cloud.size).toBe(2);
  });

  it("o id de dentro tem de ser o de fora", async () => {
    // Cifrado com o AAD certo, mas o conteudo diz outro id: e o telemovel a
    // escrever mal, e aceitar deixava o recibo com um id e a cloud com outro.
    const w = await world();
    await w.put(ID_A, entry(ID_B), ID_A);

    const report = await pullInbox(w.deps);

    expect(report.failures.map((f) => f.id)).toEqual([ID_A]);
  });

  it("uma entrada que a base recusa nao prende as seguintes", async () => {
    // A primeira volta sempre primeiro (a caixa e lida por ordem de chegada).
    // Se a falha dela parasse o pull, nada do que viesse depois chegava nunca.
    const w = await world();
    await w.put(ID_A, entry(ID_A, { amount: "1.00" }));
    await w.put(ID_B, entry(ID_B, { amount: "2.00" }));
    const receive = w.deps.receive;
    w.deps.receive = async (id, input) => {
      if (id === ID_A) throw new Error("numeric field overflow");
      return receive(id, input);
    };

    const report = await pullInbox(w.deps);

    expect(report.received).toBe(1);
    expect(report.failures).toEqual([{ id: ID_A, reason: expect.stringContaining("could not be saved") }]);
    expect(w.queue.map((q) => q.sourceId)).toEqual([ID_B]);
    // Nao foi gravada, por isso nao se apaga: fica para a proxima.
    expect(w.cloud.has(ID_A)).toBe(true);
    expect(w.cloud.has(ID_B)).toBe(false);
  });

  it("mantem a ordem da caixa", async () => {
    const w = await world();
    await w.put(ID_A, entry(ID_A, { amount: "1.00" }));
    await w.put(ID_B, entry(ID_B, { amount: "2.00" }));

    await pullInbox(w.deps);

    expect(w.queue.map((q) => q.input.amount)).toEqual(["1.00", "2.00"]);
  });

  it("caixa vazia, relatorio vazio", async () => {
    const w = await world();
    expect(await pullInbox(w.deps)).toEqual({ received: 0, failures: [] });
  });
});
