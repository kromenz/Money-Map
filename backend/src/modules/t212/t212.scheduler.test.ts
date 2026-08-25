import { describe, it, expect } from "vitest";
import {
  isSyncing,
  pickUserId,
  runSyncNow,
  SyncInProgressError,
} from "./t212.scheduler";
import type { SyncDeps } from "./t212.sync";

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

describe("runSyncNow", () => {
  // O limite de pedidos da T212 e por conta, e cada corrida constroi o seu
  // cliente com o seu proprio governo de limites -- dois clientes ao mesmo
  // tempo ignoram-se e queimam o limite um contra o outro. A bandeira fechava
  // so o tick do agendador contra si proprio; o botao "Sincronizar agora" chama
  // o runSyncNow directamente e passava-lhe ao lado.
  const fakeDeps = (
    aoEntrar: (path: string) => Promise<void>
  ): Partial<SyncDeps> => ({
    client: {
      request: async (path: string) => {
        await aoEntrar(path);
        throw new Error("sem rede no teste");
      },
      // eslint-disable-next-line require-yield
      paginate: async function* () {
        throw new Error("sem rede no teste");
      },
    },
    repo: {
      getState: async () => null,
      knownExternalIds: async () => new Set<string>(),
      saveOrders: async () => 0,
      saveDividends: async () => 0,
      saveCashFlows: async () => 0,
      replaceHoldings: async () => 0,
      upsertSnapshot: async () => undefined,
      setState: async () => undefined,
      lastExcelMonth: async () => null,
      bridgeSource: async () => ({ cashflows: [], dividends: [] }),
      existingBridgeIds: async () => [],
      applyBridge: async () => ({ created: 0, deleted: 0 }),
    },
    now: () => new Date("2026-08-25T12:00:00Z"),
    cutoff: null,
  });

  it("duas chamadas concorrentes so produzem uma corrida", async () => {
    let corridas = 0;
    let libertar: () => void = () => undefined;
    const bloqueio = new Promise<void>((resolve) => {
      libertar = resolve;
    });

    // /positions e a primeira etapa do syncAll, portanto conta uma vez por
    // corrida. Segurar ali mantem a primeira corrida a decorrer enquanto a
    // segunda chamada acontece.
    const deps = fakeDeps(async (path) => {
      if (!path.includes("positions")) return;
      corridas += 1;
      await bloqueio;
    });

    const primeira = runSyncNow("u1", deps);
    // Sem await de permeio de proposito: o guarda tem de fechar antes do
    // primeiro await do runSyncNow, senao as duas chamadas passavam.
    await expect(runSyncNow("u1", deps)).rejects.toBeInstanceOf(
      SyncInProgressError
    );

    expect(isSyncing()).toBe(true);
    libertar();
    await primeira;

    expect(corridas).toBe(1);
    expect(isSyncing()).toBe(false);
  });

  it("depois de a corrida acabar, a seguinte volta a passar", async () => {
    let corridas = 0;
    const deps = fakeDeps(async (path) => {
      if (path.includes("positions")) corridas += 1;
    });

    await runSyncNow("u1", deps);
    await runSyncNow("u1", deps);

    expect(corridas).toBe(2);
  });

  it("uma corrida que rebenta por inteiro liberta a bandeira", async () => {
    // Sem o finally, um erro fora das etapas deixava a bandeira levantada para
    // sempre e a app nunca mais sincronizava -- em silencio.
    const deps: Partial<SyncDeps> = {
      repo: null as never,
      client: null as never,
    };

    await expect(runSyncNow("u1", deps)).rejects.toThrow();
    expect(isSyncing()).toBe(false);
  });
});
