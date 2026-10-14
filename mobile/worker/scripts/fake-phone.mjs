// Faz de telemovel: cifra como a PWA vai cifrar e fala com a caixa.
//
//   node scripts/fake-phone.mjs vector
//   node scripts/fake-phone.mjs send    "<url de emparelhamento>" '<json da entrada sem id>' [id]
//   node scripts/fake-phone.mjs status  "<url de emparelhamento>" <id,id,...>
//   node scripts/fake-phone.mjs catalog "<url de emparelhamento>"
//
// A URL de emparelhamento e a que o POST /inbox/pairing devolve. A entrada
// tambem pode vir de um ficheiro, com '@caminho.json': no PowerShell 5.1 um
// JSON com espacos nao sobrevive como argumento de um exe.

import { readFileSync } from "node:fs";

const enc = new TextEncoder();
const b64 = (u) => Buffer.from(u).toString("base64");

function parsePairing(url) {
  const u = new URL(url);
  const frag = new URLSearchParams(u.hash.slice(1));
  return {
    base: `${u.protocol}//${u.host}`,
    key: Buffer.from(frag.get("k"), "base64url"),
    token: frag.get("t"),
  };
}

async function aes(raw) {
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function seal(key, value, aad, iv = crypto.getRandomValues(new Uint8Array(12))) {
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(JSON.stringify(value))
  );
  return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(new Uint8Array(ct)) });
}

async function open(key, blob, aad) {
  const e = JSON.parse(blob);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(e.iv, "base64"), additionalData: enc.encode(aad) },
    key,
    Buffer.from(e.ct, "base64")
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

const [cmd, pairing, arg, maybeId] = process.argv.slice(2);

if (cmd === "vector") {
  // O vetor fixo de backend/src/modules/inbox/inbox.crypto.test.ts.
  const key = await aes(new Uint8Array(32).map((_, i) => i));
  const iv = new Uint8Array(12).map((_, i) => 0xa0 + i);
  const id = "11111111-1111-4111-8111-111111111111";
  console.log(await seal(key, { id, amount: "2.50" }, id, iv));
} else if (cmd === "send") {
  const p = parsePairing(pairing);
  const id = maybeId ?? crypto.randomUUID();
  const raw = arg.startsWith("@") ? readFileSync(arg.slice(1), "utf8") : arg;
  const entry = { id, createdAt: new Date().toISOString(), ...JSON.parse(raw) };
  const res = await fetch(`${p.base}/api/entries`, {
    method: "POST",
    headers: { authorization: `Bearer ${p.token}`, "content-type": "application/json" },
    body: JSON.stringify({ id, blob: await seal(await aes(p.key), entry, id) }),
  });
  console.log(res.status, id);
} else if (cmd === "status") {
  const p = parsePairing(pairing);
  const res = await fetch(`${p.base}/api/entries/status?ids=${arg}`, {
    headers: { authorization: `Bearer ${p.token}` },
  });
  console.log(res.status, await res.text());
} else if (cmd === "catalog") {
  const p = parsePairing(pairing);
  const res = await fetch(`${p.base}/api/catalog`, {
    headers: { authorization: `Bearer ${p.token}` },
  });
  if (!res.ok) {
    console.log(res.status, await res.text());
    process.exit(1);
  }
  const { blob } = await res.json();
  console.log(JSON.stringify(await open(await aes(p.key), blob, "catalog"), null, 2));
} else {
  console.error("comandos: vector | send | status | catalog");
  process.exit(2);
}
