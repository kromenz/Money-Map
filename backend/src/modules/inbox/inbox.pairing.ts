import { createHash, randomBytes } from "node:crypto";

/** 32 bytes aleatorios; em base64url cabem numa URL sem escapes. */
export function newDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/** O Worker so guarda isto. Igual ao hashToken do Worker (mobile/worker/src/auth.ts). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * A URL do QR. Chave e token vao no fragmento (#), que o browser nunca manda
 * a nenhum servidor -- nem ao Worker que serve a pagina.
 */
export function pairingUrl(base: string, key: Uint8Array, token: string): string {
  return `${base}/#k=${Buffer.from(key).toString("base64url")}&t=${token}`;
}
