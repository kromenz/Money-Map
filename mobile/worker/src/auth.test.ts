import { describe, it, expect } from "vitest";
import { hashToken } from "./auth";

describe("hashToken", () => {
  it("e o SHA-256 em hex, igual ao do backend", async () => {
    // O mesmo vetor do inbox.pairing.test.ts.
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
