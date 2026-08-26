// So do lado servidor. Le e escreve em BUDGET_FOLDER, que nunca chega ao browser.
import { readFile, writeFile, rename, copyFile, mkdir, open, access, unlink } from "node:fs/promises";
import path from "node:path";
import type { PendingExpense } from "@/types/expense";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const BACKUPS = ".backups";

export function budgetFolder(): string | null {
  return process.env.BUDGET_FOLDER || null;
}

export function sheetPath(folder: string, year: number): string {
  return path.join(folder, `${year}.xlsx`);
}

/**
 * Uma escrita e um varrimento nunca correm ao mesmo tempo sobre a mesma pasta.
 *
 * A cadeia de promessas ao nivel do modulo e o mesmo padrao do `inFlight` do
 * folder-scan: cada chamada encadeia na anterior, e um erro numa nao trava as
 * seguintes.
 */
let chain: Promise<unknown> = Promise.resolve();

export function withFolderLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.catch(() => undefined).then(fn);
  chain = next.catch(() => undefined);
  return next;
}

/**
 * A folha para {year} nao existe na pasta.
 *
 * Distinto de bloqueada: sem esta distincao um pedido para um ano sem folha
 * ficava enfileirado como pendente para sempre, porque a folha que faltava
 * nunca ia deixar de "estar aberta". A rota apanha isto para dar o erro
 * especifico em vez de um pending que nunca se resolve.
 */
export class SheetMissingError extends Error {}

/** O ficheiro de bloqueio que o Excel cria ao lado da folha que tem aberta. */
async function hasLockMarker(folder: string, year: number): Promise<boolean> {
  try {
    await access(path.join(folder, `~$${year}.xlsx`));
    return true;
  } catch {
    return false;
  }
}

/**
 * O Excel tem a folha aberta?
 *
 * Duas verificacoes porque nenhuma chega sozinha: o ficheiro de bloqueio pode
 * ficar para tras depois de um Excel morto, e a abertura em modo escrita pode
 * falhar por outra razao qualquer.
 */
export async function isLocked(folder: string, year: number): Promise<boolean> {
  if (await hasLockMarker(folder, year)) return true;

  try {
    const handle = await open(sheetPath(folder, year), "r+");
    await handle.close();
    return false;
  } catch (err) {
    // ENOENT quer dizer que a folha nao existe, nao que esta bloqueada. As
    // duas causas fazem `open` falhar da mesma maneira, mas tem respostas
    // diferentes: bloqueada fica pendente ate o Excel fechar; inexistente
    // nunca vai deixar de o estar, por isso enfileirar isso era uma fila sem
    // saida. Distinguir pelo `code` deixa a rota dar o erro certo.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new SheetMissingError(`no sheet for ${year}`);
    }
    return true;
  }
}

/**
 * So faz sentido chamar depois de isLocked ja ter devolvido true: aqui so se
 * decide se a explicacao a mostrar e "o Excel tem-na aberta" ou outra coisa
 * qualquer -- um atributo so-de-leitura, uma ACL, um antivirus a segurar o
 * ficheiro. Sem isto, qualquer bloqueio nao-Excel ficava indistinguivel do
 * caso normal e o utilizador via "close Excel" para sempre, mesmo de olhos no
 * Excel fechado.
 */
export async function isExcelLock(folder: string, year: number): Promise<boolean> {
  return hasLockMarker(folder, year);
}

export async function readYear(folder: string, year: number): Promise<Uint8Array> {
  return new Uint8Array(await readFile(sheetPath(folder, year)));
}

/**
 * Resultado de writeYear.
 *
 * "alreadyWritten" distingue as duas formas de falhar depois do rename ter
 * substituido a folha:
 *  - false: o import recusou e o backup foi reposto -- a folha voltou ao
 *    estado anterior, nada para enfileirar, so relatar o erro.
 *  - true: o import recusou e a REPOSICAO do backup tambem falhou -- a folha
 *    fica com o gasto la escrito. Enfileirar isto como pendente escrevia-o
 *    outra vez no proximo flush, duplicando-o. Os dois casos tem "ok: false"
 *    para que qualquer chamador que ainda nao saiba desta distincao continue
 *    a tratar como erro (nunca como sucesso), mas os chamadores que
 *    verificam alreadyWritten tratam-nos de forma diferente.
 */
export type WriteResult =
  | { ok: true }
  | { ok: false; reason: string; alreadyWritten: false }
  | { ok: false; reason: string; alreadyWritten: true };

/**
 * Grava, importa, e repoe o backup se o import nao aceitar.
 *
 * O backup vai para uma subpasta e nunca para a raiz: o planFolderScan rejeita
 * os dois ficheiros que reclamem o mesmo ano, portanto um `2026.bak.xlsx` solto
 * ao lado partia o varrimento inteiro e a app arrancava sem dados. O readdir do
 * varrimento filtra por isFile(), por isso uma subpasta e invisivel para ele.
 *
 * A reposicao e por copia e nao por rename: um rename consumia o proprio backup
 * e deixava a falha seguinte sem rede.
 */
export async function writeYear(
  folder: string,
  year: number,
  bytes: Uint8Array,
  cookie: string
): Promise<WriteResult> {
  const target = sheetPath(folder, year);

  const backupDir = path.join(folder, BACKUPS);
  await mkdir(backupDir, { recursive: true });
  // O carimbo entra no nome com ':' trocado, que o Windows nao aceita em nomes.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(backupDir, `${year}-${stamp}.xlsx`);
  await copyFile(target, backup);

  // Escrita atomica: nunca existe um .xlsx meio escrito na pasta, nem por um
  // instante -- o que importa porque o varrimento pode estar a ler.
  const tmp = `${target}.tmp`;
  try {
    await writeFile(tmp, bytes);
    await rename(tmp, target);
  } catch (err) {
    // O rename falha sobretudo quando o Excel abriu o ficheiro exactamente
    // nesta janela, entre o isLocked e aqui. Sem isto o .tmp ficava orfao na
    // pasta vigiada pelo varrimento. Melhor esforco: se o unlink tambem
    // falhar, o erro original e que importa, nao este.
    await unlink(tmp).catch(() => undefined);
    throw err;
  }

  const imported = await importYear(year, bytes, cookie);
  if (imported.ok === true) return { ok: true };
  // "=== true"/"=== false" e nao "if (x.ok)"/"!x.ok": sem strictNullChecks
  // (tsconfig deste projecto) o tsc so estreita a uniao discriminada por
  // comparacao com o literal, nunca por veracidade -- mesma regra que ja
  // documentada mais abaixo para o "result" da rota.
  const importReason = imported.ok === false ? imported.reason : "";

  const restored = await restoreBackup(backup, target);
  if (!restored) {
    // O rename ja tinha substituido a folha por esta com o gasto la dentro,
    // e agora a reposicao do backup tambem falhou -- provavelmente o Excel
    // agarrou o ficheiro nesta janela. A folha fica exactamente como o
    // import recusou: com o gasto escrito e os subtotais que nao batem. Nao
    // se pode devolver isto como se nada tivesse sido escrito -- ver o
    // comentario em WriteResult.
    return {
      ok: false,
      reason:
        "the sheet may already contain this expense, and the backup could not be restored automatically",
      alreadyWritten: true,
    };
  }

  return { ok: false, reason: importReason, alreadyWritten: false };
}

/** Repoe o backup por copia. Devolve false em vez de lancar -- writeYear
 * precisa de distinguir este caso do resto, nao de o tratar como excepcao. */
async function restoreBackup(backup: string, target: string): Promise<boolean> {
  try {
    await copyFile(backup, target);
    return true;
  } catch {
    return false;
  }
}

async function importYear(
  year: number,
  bytes: Uint8Array,
  cookie: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const form = new FormData();
  // new Uint8Array(bytes) e nao so `bytes`: o parametro e tipado como
  // Uint8Array<ArrayBufferLike>, que o BlobPart do lib.dom nao aceita porque
  // inclui SharedArrayBuffer. Copiar para um array concreto resolve o tipo
  // sem mudar os bytes. Mesmo padrao do folder-scan/route.ts.
  form.append("file", new Blob([new Uint8Array(bytes)]), `${year}.xlsx`);
  form.append("year", String(year));

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/budget/import`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
  } catch {
    return { ok: false, reason: "the API could not be reached" };
  }

  if (res.ok) return { ok: true };
  if (res.status === 401) return { ok: false, reason: "your session expired" };
  // 422 = a transaccao do import reverteu, portanto a base de dados esta
  // intacta e repor o ficheiro deixa tudo consistente.
  if (res.status === 422) {
    return { ok: false, reason: "the sheet totals did not add up — nothing was changed" };
  }
  return { ok: false, reason: `import failed (${res.status})` };
}

/** Enfileira no backend. Usa-se quando o Excel tem o ficheiro aberto. */
export async function queuePending(
  cookie: string,
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/budget/pending`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function countPending(cookie: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/budget/pending`, { headers: { cookie } });
    if (!res.ok) return 0;
    const data = (await res.json()) as { pending: unknown[] };
    return data.pending.length;
  } catch {
    return 0;
  }
}

/** Le a fila inteira do utilizador. Usa-se para agrupar por ano antes de aplicar. */
export async function fetchPending(cookie: string): Promise<PendingExpense[]> {
  try {
    const res = await fetch(`${API_BASE}/budget/pending`, { headers: { cookie } });
    if (!res.ok) return [];
    const data = (await res.json()) as { pending: PendingExpense[] };
    return data.pending;
  } catch {
    return [];
  }
}

/**
 * Apaga da fila por lista de ids, so depois de os pendentes terem sido
 * aplicados. Devolve se a limpeza teve sucesso: o chamador tem de saber, senao
 * um lote ja escrito na folha mas nao limpo fica marcado como aplicado por
 * engano e a proxima montagem volta a escreve-lo.
 */
export async function clearPending(cookie: string, ids: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/budget/pending/clear`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tenta limpar ate 3 vezes, com uma pequena pausa entre tentativas.
 *
 * Isto estreita a janela do duplo-registo (uma quebra so transitoria na rede
 * ou no backend deixava de sujar a fila), mas nao a fecha: uma falha
 * persistente ainda deixa os ids por limpar e devolve false, o mesmo estado
 * distinto que ja existia. Fechar a janela a serio precisava de a escrita
 * ser idempotente -- por exemplo o backend recusar aplicar um id de pendente
 * que ja tivesse marcado como aplicado -- o que nao existe hoje e fica fora
 * deste ajuste.
 */
export async function clearPendingRetrying(
  cookie: string,
  ids: string[],
  attempts = 3,
  waitMs = 300
): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await clearPending(cookie, ids)) return true;
    if (attempt < attempts) await delay(waitMs);
  }
  return false;
}

/**
 * O que a ponte do Trading 212 ainda deve a folha.
 *
 * Vive aqui e nao no servico do browser porque so o lado servidor tem o
 * BUDGET_FOLDER -- e quem escreve na folha e este lado.
 */
export async function fetchBridgePending(
  cookie: string
): Promise<import("@/types/bridge").SheetEdit[]> {
  try {
    const res = await fetch(`${API_BASE}/t212/sheet/pending`, {
      headers: { cookie },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { edits: import("@/types/bridge").SheetEdit[] };
    return body.edits ?? [];
  } catch {
    // A ponte e um extra do dashboard: sem backend a pagina serve na mesma.
    return [];
  }
}

/**
 * Regista no servidor o que a folha aceitou.
 *
 * Devolve false sem escrever nada quando a lista esta vazia ou o pedido falha.
 * O chamador nao volta atras por causa disso: a folha ja tem as parcelas, e a
 * marcacao perdida faz a proxima corrida propor os mesmos deltas outra vez --
 * o que e visivel e corrigivel, ao contrario de uma escrita silenciosa a dobrar.
 */
export async function markBridgeWritten(
  cookie: string,
  written: { externalId: string; amount: string }[]
): Promise<boolean> {
  if (written.length === 0) return true;
  try {
    const res = await fetch(`${API_BASE}/t212/sheet/written`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ written }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
