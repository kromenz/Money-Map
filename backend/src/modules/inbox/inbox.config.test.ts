import { describe, it, expect } from "vitest";
import { loadInboxConfig } from "./inbox.config";

const KEY = Buffer.alloc(32, 1).toString("base64");
const full = {
  INBOX_URL: "https://money-map-inbox.example.workers.dev",
  INBOX_DESKTOP_TOKEN: "segredo",
  INBOX_KEY: KEY,
};

describe("loadInboxConfig", () => {
  it("com as tres variaveis fica configurado", () => {
    const cfg = loadInboxConfig(full);
    expect(cfg.configured).toBe(true);
    expect(cfg.key).toHaveLength(32);
    expect(cfg.intervalMinutes).toBe(5);
  });

  it("falta qualquer uma e nao fica", () => {
    for (const missing of ["INBOX_URL", "INBOX_DESKTOP_TOKEN", "INBOX_KEY"] as const) {
      const env = { ...full, [missing]: "" };
      expect(loadInboxConfig(env).configured).toBe(false);
    }
  });

  it("uma chave que nao tem 32 bytes conta como em falta", () => {
    expect(loadInboxConfig({ ...full, INBOX_KEY: "abc" }).configured).toBe(false);
  });

  it("tira a barra do fim da URL", () => {
    expect(loadInboxConfig({ ...full, INBOX_URL: "http://localhost:8787/" }).url).toBe(
      "http://localhost:8787"
    );
  });

  it("uma URL que nao e http(s) conta como em falta", () => {
    expect(
      loadInboxConfig({ ...full, INBOX_URL: "money-map-inbox.workers.dev" }).configured
    ).toBe(false);
  });

  it("http so para a maquina local", () => {
    // O token do desktop vai no cabecalho: por http ate um Worker publicado
    // viajava em claro.
    expect(loadInboxConfig({ ...full, INBOX_URL: "http://money-map-inbox.example.workers.dev" }).configured).toBe(false);
    expect(loadInboxConfig({ ...full, INBOX_URL: "http://localhost:8787" }).configured).toBe(true);
    expect(loadInboxConfig({ ...full, INBOX_URL: "http://127.0.0.1:8787" }).configured).toBe(true);
    expect(loadInboxConfig({ ...full, INBOX_URL: "http://localhost.evil.com" }).configured).toBe(false);
  });

  it("sem nada, nao configurado e sem rebentar", () => {
    expect(loadInboxConfig({}).configured).toBe(false);
  });
});
