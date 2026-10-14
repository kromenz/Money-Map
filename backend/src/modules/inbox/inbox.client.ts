import { z } from "zod";
import type { InboxItem } from "./inbox.pull";

export class InboxHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "InboxHttpError";
  }
}

export type InboxClient = {
  list(): Promise<InboxItem[]>;
  remove(id: string): Promise<void>;
  putCatalog(blob: string): Promise<void>;
  registerDevice(tokenHash: string, label: string): Promise<void>;
};

const listSchema = z.object({
  entries: z.array(z.object({ id: z.string(), blob: z.string() })),
});

/** Sem resposta em 10 s, desiste: o tick seguinte volta a tentar. */
const TIMEOUT_MS = 10_000;

export function createInboxClient(
  cfg: { url: string; desktopToken: string },
  fetchImpl: typeof fetch = fetch
): InboxClient {
  function call(method: string, path: string, body?: unknown): Promise<Response> {
    return fetchImpl(`${cfg.url}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${cfg.desktopToken}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  function fail(res: Response, what: string): never {
    throw new InboxHttpError(res.status, `a caixa respondeu ${res.status} a ${what}`);
  }

  return {
    async list() {
      const res = await call("GET", "/api/entries");
      if (!res.ok) fail(res, "listar");
      // Uma forma inesperada e erro e nao lista vazia: lista vazia dizia ao
      // dashboard que nao havia nada, com os gastos ainda la.
      return listSchema.parse(await res.json()).entries;
    },
    async remove(id) {
      const res = await call("DELETE", `/api/entries/${encodeURIComponent(id)}`);
      if (!res.ok && res.status !== 404) fail(res, "apagar");
    },
    async putCatalog(blob) {
      const res = await call("PUT", "/api/catalog", { blob });
      if (!res.ok) fail(res, "enviar o catalogo");
    },
    async registerDevice(tokenHash, label) {
      const res = await call("POST", "/api/devices", { tokenHash, label });
      if (!res.ok) fail(res, "registar o telemovel");
    },
  };
}
