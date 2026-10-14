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
    expect(loadT212Config({ T212_API_KEY: "k" }).syncIntervalMinutes).toBe(360);
  });

  it("le o intervalo em minutos", () => {
    // Um minuto em horas era 0.0167 -- funcionava, mas ninguem o escrevia bem.
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_SYNC_INTERVAL_MINUTES: "1" })
        .syncIntervalMinutes
    ).toBe(1);
  });

  it("continua a aceitar o intervalo em horas, que e o que os .env antigos tem", () => {
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_SYNC_INTERVAL_HOURS: "2" })
        .syncIntervalMinutes
    ).toBe(120);
  });

  it("os minutos ganham as horas quando vem os dois", () => {
    expect(
      loadT212Config({
        T212_API_KEY: "k",
        T212_SYNC_INTERVAL_MINUTES: "5",
        T212_SYNC_INTERVAL_HOURS: "2",
      }).syncIntervalMinutes
    ).toBe(5);
  });

  it("recusa um intervalo que nao e numero positivo e volta ao omisso", () => {
    for (const env of [
      { T212_SYNC_INTERVAL_HOURS: "abc" },
      { T212_SYNC_INTERVAL_HOURS: "0" },
      { T212_SYNC_INTERVAL_MINUTES: "abc" },
      { T212_SYNC_INTERVAL_MINUTES: "0" },
      { T212_SYNC_INTERVAL_MINUTES: "-3" },
    ]) {
      expect(loadT212Config({ T212_API_KEY: "k", ...env }).syncIntervalMinutes).toBe(360);
    }
  });

  it("uns minutos invalidos nao impedem as horas de valer", () => {
    expect(
      loadT212Config({
        T212_API_KEY: "k",
        T212_SYNC_INTERVAL_MINUTES: "abc",
        T212_SYNC_INTERVAL_HOURS: "2",
      }).syncIntervalMinutes
    ).toBe(120);
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

describe("loadT212Config -- utilizador alvo", () => {
  it("sem T212_USER_EMAIL fica null", () => {
    expect(loadT212Config({ T212_API_KEY: "k" }).userEmail).toBeNull();
  });

  it("le o T212_USER_EMAIL quando existe", () => {
    expect(
      loadT212Config({ T212_API_KEY: "k", T212_USER_EMAIL: "ana@exemplo.pt" })
        .userEmail
    ).toBe("ana@exemplo.pt");
  });
});
