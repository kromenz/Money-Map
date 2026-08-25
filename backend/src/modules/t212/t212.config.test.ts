import { describe, it, expect } from "vitest";
import { loadT212Config } from "./t212.config";

describe("loadT212Config", () => {
  it("fica por configurar sem chave", () => {
    const cfg = loadT212Config({});
    expect(cfg.configured).toBe(false);
  });

  it("fica configurado com chave, mesmo sem secret", () => {
    // Se a conta so emitir chave, o Basic envia palavra-passe vazia.
    const cfg = loadT212Config({ T212_API_KEY: "k" });
    expect(cfg.configured).toBe(true);
    expect(cfg.apiSecret).toBe("");
  });

  it("aponta para live por omissao", () => {
    expect(loadT212Config({ T212_API_KEY: "k" }).baseUrl).toBe(
      "https://live.trading212.com"
    );
  });

  it("aponta para demo quando pedido", () => {
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_ENV: "demo" }).baseUrl
    ).toBe("https://demo.trading212.com");
  });

  it("o baseUrl nao inclui /api/v0 -- o nextPagePath ja traz o caminho todo", () => {
    expect(loadT212Config({ T212_API_KEY: "k" }).baseUrl).not.toContain("/api");
  });

  it("usa seis horas por omissao", () => {
    expect(loadT212Config({ T212_API_KEY: "k" }).syncIntervalHours).toBe(6);
  });

  it("recusa um intervalo que nao e numero positivo e volta ao omisso", () => {
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_SYNC_INTERVAL_HOURS: "abc" })
        .syncIntervalHours
    ).toBe(6);
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_SYNC_INTERVAL_HOURS: "0" })
        .syncIntervalHours
    ).toBe(6);
  });

  it("aceita uma data de corte em YYYY-MM-DD", () => {
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_BRIDGE_FROM: "2026-09-01" })
        .bridgeFrom
    ).toBe("2026-09-01");
  });

  it("ignora uma data de corte torta em vez de a aceitar", () => {
    // Uma data invalida aqui deslocava o corte em silencio e duplicava
    // poupanca na grelha. Melhor cair no calculo derivado.
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_BRIDGE_FROM: "01/09/2026" })
        .bridgeFrom
    ).toBeNull();
  });
});
