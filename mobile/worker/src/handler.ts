import { bearer, hashToken } from "./auth";
import type { Store } from "./store";

type Role = "desktop" | "phone";
type Env = { DESKTOP_TOKEN: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Uma entrada cifrada tem uns 300 bytes; 8 KB e folga, nao um convite. */
const MAX_ENTRY = 8192;
/** O catalogo de uma folha de 40 categorias e 200 notas fica nos 20 KB. */
const MAX_CATALOG = 262_144;
const MAX_LIST = 500;
const MAX_STATUS_IDS = 100;

const json = (status: number, body: unknown) => Response.json(body, { status });
const empty = (status: number) => new Response(null, { status });
// Sem dizer porque: quem nao tem acesso nao precisa de saber se o token
// existe, foi revogado ou e do outro papel.
const unauthorized = () => json(401, { error: "unauthorized" });

async function roleOf(req: Request, env: Env, store: Store): Promise<Role | null> {
  const token = bearer(req);
  if (!token) return null;
  const hash = await hashToken(token);
  // Comparar hashes e nao o texto: a comparacao de strings para no primeiro
  // caracter diferente, e o tempo diria quantos acertaram.
  if (env.DESKTOP_TOKEN && hash === (await hashToken(env.DESKTOP_TOKEN))) return "desktop";
  return (await store.hasDevice(hash)) ? "phone" : null;
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await req.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

type Route = "entries" | "status" | "entry" | "catalog" | "devices" | "device";

function routeOf(parts: string[]): Route | null {
  const [head, second] = parts;
  if (head === "entries" && parts.length === 1) return "entries";
  if (head === "entries" && second === "status" && parts.length === 2) return "status";
  if (head === "entries" && parts.length === 2) return "entry";
  if (head === "catalog" && parts.length === 1) return "catalog";
  if (head === "devices" && parts.length === 1) return "devices";
  if (head === "devices" && parts.length === 2) return "device";
  return null;
}

/**
 * A caixa. Guarda blobs que nao sabe ler e responde a dois papeis: o desktop
 * (o backend do Money-Map, com o DESKTOP_TOKEN) e os telemoveis emparelhados
 * (token cujo hash esta em devices).
 */
export async function handle(
  req: Request,
  env: Env,
  store: Store,
  now: () => Date = () => new Date()
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return empty(404);

  let parts: string[];
  try {
    parts = path.slice("/api/".length).split("/").map(decodeURIComponent);
  } catch {
    return empty(404);
  }
  const route = routeOf(parts);
  if (!route) return empty(404);

  const role = await roleOf(req, env, store);
  if (!role) return unauthorized();
  const method = req.method;

  if (route === "entries" && method === "POST") {
    if (role !== "phone") return unauthorized();
    const b = await body(req);
    if (!b || typeof b.id !== "string" || !UUID.test(b.id) || typeof b.blob !== "string") {
      return json(400, { error: "expected {id: uuid, blob: string}" });
    }
    if (b.blob.length > MAX_ENTRY) return json(413, { error: "entry too large" });
    await store.addEntry(b.id.toLowerCase(), b.blob, now().toISOString());
    return empty(201);
  }

  if (route === "entries" && method === "GET") {
    if (role !== "desktop") return unauthorized();
    return json(200, { entries: await store.listEntries(MAX_LIST) });
  }

  if (route === "status" && method === "GET") {
    if (role !== "phone") return unauthorized();
    const ids = (url.searchParams.get("ids") ?? "")
      .split(",")
      .filter(Boolean)
      .map((i) => i.toLowerCase());
    if (ids.length > MAX_STATUS_IDS) return json(400, { error: "too many ids" });
    return json(200, { present: await store.presentIds(ids) });
  }

  if (route === "entry" && method === "DELETE") {
    await store.deleteEntry(parts[1].toLowerCase());
    return empty(204);
  }

  if (route === "catalog" && method === "GET") {
    if (role !== "phone") return unauthorized();
    const blob = await store.getCatalog();
    return blob === null ? json(404, { error: "no catalog yet" }) : json(200, { blob });
  }

  if (route === "catalog" && method === "PUT") {
    if (role !== "desktop") return unauthorized();
    const b = await body(req);
    if (!b || typeof b.blob !== "string") return json(400, { error: "expected {blob: string}" });
    if (b.blob.length > MAX_CATALOG) return json(413, { error: "catalog too large" });
    await store.putCatalog(b.blob, now().toISOString());
    return empty(204);
  }

  if (route === "devices" && method === "POST") {
    if (role !== "desktop") return unauthorized();
    const b = await body(req);
    if (
      !b ||
      typeof b.tokenHash !== "string" ||
      !SHA256_HEX.test(b.tokenHash) ||
      typeof b.label !== "string" ||
      b.label.length > 40
    ) {
      return json(400, { error: "expected {tokenHash: sha256 hex, label: string}" });
    }
    await store.addDevice(b.tokenHash, b.label, now().toISOString());
    return empty(201);
  }

  if (route === "device" && method === "DELETE") {
    if (role !== "desktop") return unauthorized();
    await store.deleteDevice(parts[1]);
    return empty(204);
  }

  return empty(404);
}
