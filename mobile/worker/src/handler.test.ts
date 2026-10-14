import { describe, it, expect, beforeEach } from "vitest";
import { handle } from "./handler";
import { memoryStore, type Store } from "./store";
import { hashToken } from "./auth";

const env = { DESKTOP_TOKEN: "desk" };
const PHONE = "phone-token";
const ID = "5b1d2c3e-4f50-4a61-8b72-9c8d7e6f5a40";
const ID2 = "6c2e3d4f-5061-4b72-9c83-0d9e8f7a6b51";

let store: Store;
let clock = 0;
const now = () => new Date(Date.UTC(2026, 9, 14, 12, 0, clock++));

function req(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return handle(
    new Request(`https://inbox.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    store,
    now
  );
}

beforeEach(async () => {
  store = memoryStore();
  clock = 0;
  await store.addDevice(await hashToken(PHONE), "iPhone", now().toISOString());
});

describe("autenticacao", () => {
  it("sem token, 401 em todas as rotas", async () => {
    const routes: [string, string][] = [
      ["GET", "/api/entries"],
      ["POST", "/api/entries"],
      ["GET", "/api/catalog"],
      ["PUT", "/api/catalog"],
      ["POST", "/api/devices"],
      ["DELETE", `/api/entries/${ID}`],
    ];
    for (const [m, p] of routes) {
      const res = await req(m, p, null, m === "GET" || m === "DELETE" ? undefined : {});
      expect(res.status, `${m} ${p}`).toBe(401);
      expect(await res.json()).toEqual({ error: "unauthorized" });
    }
  });

  it("um token desconhecido e 401", async () => {
    expect((await req("GET", "/api/catalog", "outro")).status).toBe(401);
  });

  it("o telemovel nao le a caixa nem mexe no catalogo ou nos dispositivos", async () => {
    expect((await req("GET", "/api/entries", PHONE)).status).toBe(401);
    expect((await req("PUT", "/api/catalog", PHONE, { blob: "x" })).status).toBe(401);
    expect(
      (await req("POST", "/api/devices", PHONE, { tokenHash: "a".repeat(64), label: "x" })).status
    ).toBe(401);
  });

  it("o desktop nao escreve entradas nem le o catalogo", async () => {
    expect((await req("POST", "/api/entries", "desk", { id: ID, blob: "b" })).status).toBe(401);
    expect((await req("GET", "/api/catalog", "desk")).status).toBe(401);
  });

  it("revogar o dispositivo corta-lhe o acesso", async () => {
    const hash = await hashToken(PHONE);
    expect((await req("DELETE", `/api/devices/${hash}`, "desk")).status).toBe(204);
    expect((await req("GET", "/api/catalog", PHONE)).status).toBe(401);
  });

  it("caminho fora da API e 404, nao 401", async () => {
    expect((await req("GET", "/api/nada", "desk")).status).toBe(404);
    expect((await req("GET", "/", null)).status).toBe(404);
  });
});

describe("entradas", () => {
  it("o telemovel deixa, o desktop le", async () => {
    expect((await req("POST", "/api/entries", PHONE, { id: ID, blob: "cifrado" })).status).toBe(201);
    const res = await req("GET", "/api/entries", "desk");
    expect(await res.json()).toEqual({ entries: [{ id: ID, blob: "cifrado" }] });
  });

  it("reenviar o mesmo id nao duplica nem substitui", async () => {
    // O pedido expirou no telemovel mas tinha chegado.
    await req("POST", "/api/entries", PHONE, { id: ID, blob: "primeiro" });
    expect((await req("POST", "/api/entries", PHONE, { id: ID, blob: "segundo" })).status).toBe(201);
    const { entries } = (await (await req("GET", "/api/entries", "desk")).json()) as {
      entries: unknown[];
    };
    expect(entries).toEqual([{ id: ID, blob: "primeiro" }]);
  });

  it("le pela ordem de chegada", async () => {
    await req("POST", "/api/entries", PHONE, { id: ID2, blob: "1" });
    await req("POST", "/api/entries", PHONE, { id: ID, blob: "2" });
    const { entries } = (await (await req("GET", "/api/entries", "desk")).json()) as {
      entries: { id: string }[];
    };
    expect(entries.map((e) => e.id)).toEqual([ID2, ID]);
  });

  it("recusa id que nao e UUID e blob que nao e texto", async () => {
    expect((await req("POST", "/api/entries", PHONE, { id: "1", blob: "b" })).status).toBe(400);
    expect((await req("POST", "/api/entries", PHONE, { id: ID, blob: 3 })).status).toBe(400);
    expect((await req("POST", "/api/entries", PHONE, "nao e objecto")).status).toBe(400);
  });

  it("recusa blob grande demais", async () => {
    expect(
      (await req("POST", "/api/entries", PHONE, { id: ID, blob: "x".repeat(8193) })).status
    ).toBe(413);
  });

  it("apagar e idempotente, para os dois papeis", async () => {
    await req("POST", "/api/entries", PHONE, { id: ID, blob: "b" });
    expect((await req("DELETE", `/api/entries/${ID}`, PHONE)).status).toBe(204);
    expect((await req("DELETE", `/api/entries/${ID}`, "desk")).status).toBe(204);
  });

  it("o estado diz quais ainda estao na caixa, sem os blobs", async () => {
    await req("POST", "/api/entries", PHONE, { id: ID, blob: "segredo" });
    const res = await req("GET", `/api/entries/status?ids=${ID},${ID2}`, PHONE);
    expect(await res.json()).toEqual({ present: [ID] });
  });

  it("o estado recusa mais de 100 ids", async () => {
    const ids = Array.from({ length: 101 }, () => ID).join(",");
    expect((await req("GET", `/api/entries/status?ids=${ids}`, PHONE)).status).toBe(400);
  });
});

describe("catalogo", () => {
  it("o desktop poe, o telemovel le", async () => {
    expect((await req("GET", "/api/catalog", PHONE)).status).toBe(404);
    expect((await req("PUT", "/api/catalog", "desk", { blob: "v1" })).status).toBe(204);
    expect((await req("PUT", "/api/catalog", "desk", { blob: "v2" })).status).toBe(204);
    expect(await (await req("GET", "/api/catalog", PHONE)).json()).toEqual({ blob: "v2" });
  });

  it("recusa catalogo grande demais", async () => {
    expect(
      (await req("PUT", "/api/catalog", "desk", { blob: "x".repeat(262_145) })).status
    ).toBe(413);
  });
});

describe("dispositivos", () => {
  it("o desktop regista, e o token passa a entrar", async () => {
    const hash = await hashToken("novo");
    expect(
      (await req("POST", "/api/devices", "desk", { tokenHash: hash, label: "iPhone" })).status
    ).toBe(201);
    expect((await req("GET", "/api/catalog", "novo")).status).toBe(404);
  });

  it("recusa um hash que nao e SHA-256 em hex", async () => {
    expect(
      (await req("POST", "/api/devices", "desk", { tokenHash: "abc", label: "x" })).status
    ).toBe(400);
  });
});
