import { describe, it, expect } from "vitest";
import { hashToken, newDeviceToken, pairingUrl } from "./inbox.pairing";

describe("emparelhamento", () => {
  it("o hash e SHA-256 em hex, igual ao do Worker", () => {
    // Vetor conhecido do SHA-256. O teste do Worker usa o mesmo.
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("cada token e novo e cabe numa URL", () => {
    const a = newDeviceToken();
    expect(a).not.toBe(newDeviceToken());
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("a chave e o token vao no fragmento, em base64url", () => {
    const key = new Uint8Array(32).fill(255);
    const url = pairingUrl("https://inbox.example", key, "tok");
    // O fragmento nunca sai do browser: nem o Worker o ve nos pedidos.
    expect(url).toBe(`https://inbox.example/#k=${"_".repeat(42)}8&t=tok`);
  });
});
