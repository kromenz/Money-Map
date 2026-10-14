import { describe, it, expect, vi } from "vitest";

// O servico importa os recibos e o catalogo, que importam a Prisma. Nao se
// chegam a usar (os testes injectam tudo), mas o import tem de resolver.
vi.mock("../../db/prisma", () => ({ prisma: {} }));

import { runInboxSync, type InboxServiceDeps } from "./inbox.service";
import type { InboxClient } from "./inbox.client";
import { importKey, open } from "./inbox.crypto";

const config = {
  configured: true,
  url: "http://inbox.test",
  desktopToken: "segredo",
  key: new Uint8Array(32).fill(1),
  intervalMinutes: 5,
};

function deps(over: Partial<InboxServiceDeps> = {}): Partial<InboxServiceDeps> {
  const client: InboxClient = {
    list: vi.fn(async () => []),
    remove: vi.fn(async () => undefined),
    putCatalog: vi.fn(async () => undefined),
    registerDevice: vi.fn(async () => undefined),
  };
  return {
    config,
    client,
    alreadyReceived: async () => false,
    receiverFor: () => async () => undefined,
    buildCatalog: async () => ({ categories: [], notes: [], builtAt: "x" }),
    ...over,
  };
}

describe("runInboxSync", () => {
  it("duas chamadas ao mesmo tempo partilham a mesma corrida", async () => {
    // O tick e o dashboard podem pedir ao mesmo tempo. Duas corridas em
    // paralelo liam a mesma caixa e so o recibo as separava -- e o dashboard
    // recebia received 0 da corrida que perdeu.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const d = deps();
    d.client!.list = vi.fn(async () => {
      await gate;
      return [];
    });

    const a = runInboxSync("u1", d);
    const b = runInboxSync("u1", d);
    release();

    expect(await a).toBe(await b);
    expect(d.client!.list).toHaveBeenCalledTimes(1);
  });

  it("uma falha nao prende as seguintes", async () => {
    // O Worker em baixo uma vez nao pode deixar o inFlight preso numa
    // promessa rejeitada para sempre.
    const failing = deps();
    failing.client!.list = vi.fn(async () => {
      throw new Error("sem rede");
    });
    await expect(runInboxSync("u1", failing)).rejects.toThrow("sem rede");

    await expect(runInboxSync("u1", deps())).resolves.toMatchObject({ received: 0 });
  });

  it("o catalogo falhar nao falha a sincronizacao", async () => {
    const d = deps();
    d.client!.putCatalog = vi.fn(async () => {
      throw new Error("413");
    });

    await expect(runInboxSync("u1", d)).resolves.toMatchObject({ catalogPushed: false });
  });

  it("envia o catalogo cifrado com o AAD do catalogo", async () => {
    const d = deps();
    await runInboxSync("u1", d);

    const blob = (d.client!.putCatalog as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const opened = await open(await importKey(config.key), blob, "catalog");
    expect(opened).toEqual({ categories: [], notes: [], builtAt: "x" });
  });

  it("sem configuracao recusa sem tocar na rede", async () => {
    const d = deps({ config: { ...config, configured: false } });
    await expect(runInboxSync("u1", d)).rejects.toThrow();
    expect(d.client!.list).not.toHaveBeenCalled();
  });
});
