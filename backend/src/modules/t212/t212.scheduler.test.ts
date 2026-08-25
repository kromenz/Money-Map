import { describe, it, expect } from "vitest";
import { pickUserId } from "./t212.scheduler";

const ana = { id: "u1", email: "ana@exemplo.pt" };
const rui = { id: "u2", email: "rui@exemplo.pt" };

describe("pickUserId", () => {
  it("com um so utilizador e obvio de quem e a conta", () => {
    expect(pickUserId([ana], null).userId).toBe("u1");
  });

  it("sem utilizadores nao ha nada a sincronizar", () => {
    expect(pickUserId([], null).userId).toBeNull();
  });

  it("com varios utilizadores e sem email configurado recusa escolher", () => {
    // Escrever a conta de uma pessoa no espelho de outra e pior do que nao
    // sincronizar. Fica inerte e diz porque.
    const out = pickUserId([ana, rui], null);
    expect(out.userId).toBeNull();
    expect(out.reason).toContain("T212_USER_EMAIL");
  });

  it("o email configurado desempata", () => {
    expect(pickUserId([ana, rui], "rui@exemplo.pt").userId).toBe("u2");
  });

  it("ignora maiusculas no email", () => {
    expect(pickUserId([ana, rui], "RUI@Exemplo.pt").userId).toBe("u2");
  });

  it("um email configurado que nao existe nao cai no primeiro utilizador", () => {
    const out = pickUserId([ana, rui], "ninguem@exemplo.pt");
    expect(out.userId).toBeNull();
    expect(out.reason).toContain("ninguem@exemplo.pt");
  });

  it("duas contas com o mesmo email em caixa diferente nao escolhe a primeira", () => {
    // O schema nao normaliza a caixa do email no registo, portanto isto e
    // alcancavel: duas contas distintas no Postgres que colidem so em
    // minusculas. Escolher a primeira seria a mesma aposta silenciosa que a
    // ambiguidade sem T212_USER_EMAIL ja recusa.
    const ruiMaiusculo = { id: "u3", email: "Rui@Exemplo.pt" };
    const out = pickUserId([ana, rui, ruiMaiusculo], "rui@exemplo.pt");
    expect(out.userId).toBeNull();
    expect(out.reason).toContain("rui@exemplo.pt");
  });
});
