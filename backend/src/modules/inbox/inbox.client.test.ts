import { describe, it, expect } from "vitest";
import { createInboxClient, InboxHttpError } from "./inbox.client";

type Call = { url: string; method: string; auth: string | null; body: string | null };

function fakeFetch(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { impl, calls };
}

const cfg = { url: "http://inbox.test", desktopToken: "segredo" };

describe("createInboxClient", () => {
  it("lista com o token do desktop", async () => {
    const f = fakeFetch(() => Response.json({ entries: [{ id: "a", blob: "b" }] }));
    const items = await createInboxClient(cfg, f.impl).list();

    expect(items).toEqual([{ id: "a", blob: "b" }]);
    expect(f.calls[0]).toMatchObject({
      url: "http://inbox.test/api/entries",
      method: "GET",
      auth: "Bearer segredo",
    });
  });

  it("uma resposta com outra forma e erro, nao uma lista vazia", async () => {
    const f = fakeFetch(() => Response.json({ coisas: [] }));
    await expect(createInboxClient(cfg, f.impl).list()).rejects.toThrow();
  });

  it("apagar codifica o id e aceita 404", async () => {
    // 404 e "ja nao esta la", que e o que se queria.
    const f = fakeFetch(() => new Response(null, { status: 404 }));
    await createInboxClient(cfg, f.impl).remove("a/b");
    expect(f.calls[0]).toMatchObject({ url: "http://inbox.test/api/entries/a%2Fb", method: "DELETE" });
  });

  it("um 500 vira InboxHttpError com o estado", async () => {
    const f = fakeFetch(() => new Response("x", { status: 500 }));
    const err = await createInboxClient(cfg, f.impl).list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InboxHttpError);
    expect((err as InboxHttpError).status).toBe(500);
  });

  it("envia o catalogo e regista dispositivos", async () => {
    const f = fakeFetch((c) => new Response(null, { status: c.method === "POST" ? 201 : 204 }));
    const client = createInboxClient(cfg, f.impl);
    await client.putCatalog("blob-cifrado");
    await client.registerDevice("ab".repeat(32), "iPhone");

    expect(f.calls[0]).toMatchObject({
      url: "http://inbox.test/api/catalog",
      method: "PUT",
      body: '{"blob":"blob-cifrado"}',
    });
    expect(f.calls[1]).toMatchObject({ url: "http://inbox.test/api/devices", method: "POST" });
    expect(JSON.parse(f.calls[1].body!)).toEqual({ tokenHash: "ab".repeat(32), label: "iPhone" });
  });
});
