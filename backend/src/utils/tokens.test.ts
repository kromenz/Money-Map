import { describe, it, expect, afterEach, vi } from "vitest";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./tokens";

afterEach(() => {
  vi.useRealTimers();
});

/** Congela o relogio: o "mesmo segundo" tem de ser garantido, nao provavel. */
function freezeClock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
}

describe("signRefreshToken", () => {
  it("dois tokens do mesmo utilizador no mesmo segundo sao diferentes", () => {
    // O defeito verdadeiro: o iat e o exp de um JWT contam-se em segundos
    // inteiros, portanto dois refresh tokens assinados para o mesmo sub dentro
    // do mesmo segundo saiam byte a byte iguais -- e com o mesmo tokenHash.
    // A rotacao cria a linha nova antes de apagar a velha, por isso batia na
    // restricao de unicidade e devolvia 500. Um F5 faz exactamente isto: o
    // efeito de montagem do AuthProvider corre duas vezes com 1ms de intervalo.
    freezeClock();

    const a = signRefreshToken({ sub: "utilizador-1" });
    const b = signRefreshToken({ sub: "utilizador-1" });

    expect(a).not.toBe(b);
    expect(hashToken(a)).not.toBe(hashToken(b));
  });

  it("tokens de utilizadores diferentes tambem nao colidem", () => {
    freezeClock();
    expect(signRefreshToken({ sub: "a" })).not.toBe(signRefreshToken({ sub: "b" }));
  });

  it("continua a levar o sub, que e por onde a rotacao encontra o dono", () => {
    const token = signRefreshToken({ sub: "utilizador-1" });
    const payload = verifyRefreshToken(token) as { sub: string; exp: number };

    expect(payload.sub).toBe("utilizador-1");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("um token assinado com o segredo errado nao passa", () => {
    const access = signAccessToken({ sub: "utilizador-1" });
    expect(() => verifyRefreshToken(access)).toThrow();
  });
});

describe("signAccessToken", () => {
  it("nao precisa de ser unico: nunca e guardado nem rodado", () => {
    // Deliberado, e nao um esquecimento. O access token nao tem linha na base
    // de dados; dois iguais no mesmo segundo sao o mesmo token e nao ha
    // unicidade nenhuma a violar.
    freezeClock();
    expect(signAccessToken({ sub: "a" })).toBe(signAccessToken({ sub: "a" }));
  });

  it("verifica-se com o segredo de acesso", () => {
    const payload = verifyAccessToken(signAccessToken({ sub: "a" })) as { sub: string };
    expect(payload.sub).toBe("a");
  });
});
