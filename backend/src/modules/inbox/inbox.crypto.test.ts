import { describe, it, expect } from "vitest";
import { decodeKey, EnvelopeError, importKey, open, seal, sealWithIv } from "./inbox.crypto";

// Vetor fixo, partilhado com a PWA (sub-projecto 3): se os dois lados o
// passarem, falam o mesmo formato.
const VECTOR = {
  key: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  iv: "oKGio6Slpqeoqaqr",
  aad: "11111111-1111-4111-8111-111111111111",
  value: { id: "11111111-1111-4111-8111-111111111111", amount: "2.50" },
  ct: "nToVSWfxII5TVLbiNkvx80GdaCG/g3NdrSMet06aWDDjR3bOnhNiDG6tNeolWOKUKG4oPEDqOExvazt82Z1GhEn80gtHxzssI2TpRok=",
};

const vectorKey = () => importKey(decodeKey(VECTOR.key)!);
const otherKey = () => importKey(new Uint8Array(32).fill(7));

describe("decodeKey", () => {
  it("aceita 32 bytes em base64", () => {
    expect(decodeKey(VECTOR.key)).toHaveLength(32);
  });

  it("recusa outro tamanho", () => {
    expect(decodeKey(Buffer.alloc(16).toString("base64"))).toBeNull();
  });

  it("recusa texto que nao e base64", () => {
    // O Buffer.from ignora caracteres invalidos em silencio; sem esta guarda
    // uma chave mal colada no .env virava outra chave qualquer.
    expect(decodeKey("isto nao e uma chave nenhuma, mas tem tamanho")).toBeNull();
    expect(decodeKey("")).toBeNull();
  });
});

describe("envelope", () => {
  it("bate com o vetor fixo", async () => {
    const blob = await sealWithIv(
      await vectorKey(),
      Buffer.from(VECTOR.iv, "base64"),
      VECTOR.value,
      VECTOR.aad
    );
    expect(JSON.parse(blob)).toEqual({ v: 1, iv: VECTOR.iv, ct: VECTOR.ct });
  });

  it("abre o vetor fixo", async () => {
    const blob = JSON.stringify({ v: 1, iv: VECTOR.iv, ct: VECTOR.ct });
    expect(await open(await vectorKey(), blob, VECTOR.aad)).toEqual(VECTOR.value);
  });

  it("ida e volta com IV aleatorio", async () => {
    const key = await vectorKey();
    const a = await seal(key, { x: 1 }, "e1");
    const b = await seal(key, { x: 1 }, "e1");
    // IV novo por mensagem: o mesmo conteudo nao pode dar o mesmo blob.
    expect(a).not.toBe(b);
    expect(await open(key, a, "e1")).toEqual({ x: 1 });
  });

  it("um blob copiado para outro id nao abre", async () => {
    const key = await vectorKey();
    const blob = await seal(key, { amount: "999.00" }, "id-a");
    await expect(open(key, blob, "id-b")).rejects.toBeInstanceOf(EnvelopeError);
  });

  it("outra chave nao abre", async () => {
    const blob = await seal(await vectorKey(), { x: 1 }, "e1");
    await expect(open(await otherKey(), blob, "e1")).rejects.toBeInstanceOf(EnvelopeError);
  });

  it("um ct adulterado nao abre", async () => {
    const key = await vectorKey();
    const env = JSON.parse(await seal(key, { x: 1 }, "e1"));
    const ct = Buffer.from(env.ct, "base64");
    ct[0] ^= 1;
    const tampered = JSON.stringify({ ...env, ct: ct.toString("base64") });
    await expect(open(key, tampered, "e1")).rejects.toBeInstanceOf(EnvelopeError);
  });

  it("recusa envelopes mal formados", async () => {
    const key = await vectorKey();
    for (const bad of [
      "nao e json",
      "{}",
      JSON.stringify({ v: 2, iv: VECTOR.iv, ct: VECTOR.ct }),
      JSON.stringify({ v: 1, iv: "AAAA", ct: VECTOR.ct }),
    ]) {
      await expect(open(key, bad, VECTOR.aad)).rejects.toBeInstanceOf(EnvelopeError);
    }
  });
});
