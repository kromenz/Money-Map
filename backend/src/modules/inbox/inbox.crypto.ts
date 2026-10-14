/**
 * O envelope dos dados que passam pela caixa na cloud.
 *
 * A cloud guarda so isto: nunca ve um valor, uma categoria ou uma nota. A
 * chave vive no INBOX_KEY e no telemovel, e mais nenhum sitio.
 *
 * O AAD prende cada blob ao seu id. Sem ele, quem mexesse na base da cloud
 * podia copiar o blob de um gasto para o id de outro, e o PC aceitava-o como
 * legitimo.
 */
export class EnvelopeError extends Error {}

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();

// Copia para um ArrayBuffer novo: o WebCrypto dos tipos do TS 5.9 nao aceita
// vistas sobre ArrayBufferLike, e um Buffer do Node pode partilhar um maior.
const bytes = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** A chave do .env. Nulo se nao forem exactamente 32 bytes em base64. */
export function decodeKey(b64: string): Uint8Array | null {
  const text = b64.trim();
  if (!B64.test(text)) return null;
  const raw = Buffer.from(text, "base64");
  return raw.length === 32 ? new Uint8Array(raw) : null;
}

export function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey("raw", bytes(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Existe para o vetor fixo dos testes; o resto do codigo usa seal. */
export async function sealWithIv(
  key: CryptoKey,
  iv: Uint8Array,
  value: unknown,
  aad: string
): Promise<string> {
  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv: bytes(iv), additionalData: encoder.encode(aad) },
    key,
    encoder.encode(JSON.stringify(value))
  );
  return JSON.stringify({
    v: 1,
    iv: Buffer.from(iv).toString("base64"),
    ct: Buffer.from(ct).toString("base64"),
  });
}

export function seal(key: CryptoKey, value: unknown, aad: string): Promise<string> {
  return sealWithIv(key, globalThis.crypto.getRandomValues(new Uint8Array(12)), value, aad);
}

export async function open(key: CryptoKey, blob: string, aad: string): Promise<unknown> {
  let env: unknown;
  try {
    env = JSON.parse(blob);
  } catch {
    throw new EnvelopeError("o envelope nao e JSON");
  }
  const e = env as { v?: unknown; iv?: unknown; ct?: unknown };
  if (!e || e.v !== 1 || typeof e.iv !== "string" || typeof e.ct !== "string") {
    throw new EnvelopeError("envelope com formato desconhecido");
  }
  const iv = Buffer.from(e.iv, "base64");
  if (iv.length !== 12) throw new EnvelopeError("IV com tamanho errado");

  let plain: ArrayBuffer;
  try {
    plain = await subtle.decrypt(
      { name: "AES-GCM", iv: bytes(iv), additionalData: encoder.encode(aad) },
      key,
      bytes(Buffer.from(e.ct, "base64"))
    );
  } catch {
    // Chave errada, id trocado e ct adulterado dao todos o mesmo erro: o
    // AES-GCM nao distingue, e de proposito.
    throw new EnvelopeError("nao decifra com esta chave");
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new EnvelopeError("o conteudo decifrado nao e JSON");
  }
}
