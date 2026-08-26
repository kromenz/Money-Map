import { describe, it, expect } from "vitest";
import { bridgeOutcome, externalIdFor, monthDate } from "./budget.service";

describe("monthDate", () => {
  it("data no dia 1 do mes, ao meio-dia UTC", () => {
    const d = monthDate(2026, 7);
    expect(d.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("nunca cai no mes anterior por causa de fusos", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(monthDate(2026, m).getUTCMonth()).toBe(m - 1);
    }
  });
});

describe("externalIdFor", () => {
  it("e determinístico e inclui seccao, grupo e nome", () => {
    const id = externalIdFor(2026, 3, {
      section: "expenses",
      group: "Personal and Family",
      name: "Tecnology",
    });
    expect(id).toBe("excel:2026-03:expenses/Personal and Family/Tecnology");
  });

  it("distingue duas categorias Other de seccoes diferentes", () => {
    const a = externalIdFor(2026, 1, { section: "income", group: "", name: "Other" });
    const b = externalIdFor(2026, 1, { section: "savings", group: "", name: "Other" });
    expect(a).not.toBe(b);
  });

  it("preenche o mes com zero a esquerda para ordenar bem", () => {
    const id = externalIdFor(2026, 1, { section: "income", group: "", name: "X" });
    expect(id).toContain("2026-01:");
  });
});

describe("bridgeOutcome", () => {
  // Foi o import que passou a fazer o corte avancar, portanto e no import que
  // as linhas da ponte desaparecem da grelha. O numero tem de viajar no
  // ImportResult, senao a pessoa importa a folha, ve a grelha encolher, e nao
  // ha mensagem em lado nenhum.
  it("o resultado transporta o numero de transacoes que a ponte removeu", async () => {
    const out = await bridgeOutcome(async () => ({ created: 2, deleted: 31 }));
    expect(out).toEqual({ created: 2, deleted: 31 });
  });

  it("uma reconciliacao falhada nao lanca -- a importacao ja esta confirmada", async () => {
    // Reverter uma importacao verificada ao centimo por causa da ponte seria
    // trocar um problema pequeno por um grande.
    const out = await bridgeOutcome(async () => {
      throw new Error("categoria Trading 212 em falta");
    });

    expect(out.created).toBe(0);
    expect(out.deleted).toBe(0);
    expect(out.error).toContain("categoria Trading 212 em falta");
  });

  it("mas a falha nao fica em silencio: viaja no relatorio", async () => {
    const out = await bridgeOutcome(async () => {
      throw new Error("sem ligacao a base");
    });
    expect(out.error).toBeTruthy();
  });

  it("nada a fazer da zeros sem erro, que e diferente de ter falhado", async () => {
    const out = await bridgeOutcome(async () => ({ created: 0, deleted: 0 }));
    expect(out).toEqual({ created: 0, deleted: 0 });
    expect(out.error).toBeUndefined();
  });
});
