import { describe, it, expect } from "vitest";
import { phoneInboxMessage } from "./phone-inbox";

const ok = (received: number, failures: { id: string; reason: string }[] = []) => ({
  received,
  failures,
  catalogPushed: true,
});

describe("phoneInboxMessage", () => {
  it("sem caixa configurada, nada", () => {
    expect(phoneInboxMessage(null)).toBeNull();
  });

  it("caixa vazia, nada", () => {
    // O tick corre a cada montagem; um aviso "0 entries" a cada visita era ruido.
    expect(phoneInboxMessage(ok(0))).toBeNull();
  });

  it("singular e plural", () => {
    expect(phoneInboxMessage(ok(1))?.headline).toBe("1 entry arrived from your phone.");
    expect(phoneInboxMessage(ok(3))?.headline).toBe("3 entries arrived from your phone.");
  });

  it("as que nao se leram aparecem, mesmo sem nenhuma recebida", () => {
    // A chave antiga. Calar isto deixava o utilizador a julgar que os gastos
    // estao guardados.
    const msg = phoneInboxMessage(ok(0, [{ id: "a", reason: "could not decrypt it" }]));
    expect(msg?.headline).toBe(
      "1 entry from your phone could not be read and is still waiting in the inbox."
    );
    expect(msg?.details).toEqual(["could not decrypt it"]);
  });

  it("recebidas e falhadas juntas", () => {
    const msg = phoneInboxMessage(ok(2, [{ id: "a", reason: "r1" }, { id: "b", reason: "r2" }]));
    expect(msg?.headline).toBe(
      "2 entries arrived from your phone. 2 could not be read and are still waiting in the inbox."
    );
    expect(msg?.details).toEqual(["r1", "r2"]);
  });

  it("razoes repetidas aparecem uma vez", () => {
    const msg = phoneInboxMessage(ok(0, [{ id: "a", reason: "r" }, { id: "b", reason: "r" }]));
    expect(msg?.details).toEqual(["r"]);
  });
});
