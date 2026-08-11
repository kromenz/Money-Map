import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { planFolderScan } from "@/lib/folder-scan";
import { yearFromFileName } from "@/lib/year-from-filename";
import type {
  FolderScanFailure,
  FolderScanImport,
  FolderScanResponse,
  FolderScanResult,
} from "@/types/folder-scan";

// Le o disco, por isso nao pode correr no runtime edge.
export const runtime = "nodejs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

// O varrimento corre uma vez por processo do Next -- e o que "uma vez por
// arranque" quer dizer. Guardar tambem a promessa, e nao so o resultado, faz
// com que dois separadores a abrir ao mesmo tempo esperem pelo mesmo trabalho
// em vez de lancarem dois varrimentos.
let cached: FolderScanResult | null = null;
let inFlight: Promise<FolderScanResult> | null = null;

// Conta cada varrimento lancado. So o mais recente pode escrever na cache: um
// varrimento antigo (nao forcado) a terminar depois de um forcado nao pode
// apagar o resultado mais fresco que o forcado ja deixou.
let generation = 0;

/** A API respondeu 401: o varrimento inteiro e descartado, nao guardado. */
class Unauthenticated extends Error {}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function reasonFor(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    const message = parsed.message ?? parsed.error;
    if (message) return message;
  } catch {
    // Corpo que nao e JSON: fica a descricao generica abaixo.
  }
  // 422 = os totais da folha nao batem certo com o que foi calculado, e a
  // transacao reverteu. Nada foi gravado.
  if (status === 422) return "the sheet totals do not add up";
  return `import failed (${status})`;
}

async function importOne(folder: string, file: string, year: number, cookie: string) {
  let buffer: Buffer;
  try {
    buffer = await readFile(path.join(folder, file));
  } catch {
    // Erro do fs traz o caminho absoluto embutido na mensagem (ex.: ENOENT
    // ...open 'C:\...') -- nao pode chegar ao browser. O nome do ficheiro ja
    // vai na entrada de falha, por isso chega uma mensagem generica aqui.
    throw new Error("could not be read");
  }

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)]), file);
  form.append("year", String(year));

  const res = await fetch(`${API_BASE}/budget/import`, {
    method: "POST",
    headers: { cookie },
    body: form,
  });

  if (res.status === 401) throw new Unauthenticated();
  if (res.ok) return;

  throw new Error(reasonFor(res.status, await res.text()));
}

async function scan(folder: string, cookie: string): Promise<FolderScanResult> {
  let names: string[];
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    names = entries.filter((e) => e.isFile()).map((e) => e.name);
  } catch (err) {
    // Pasta inexistente ou sem permissoes nao e fatal: a app continua a
    // funcionar com o arrastar-e-largar.
    return { imported: [], failed: [{ file: folder, year: null, reason: messageOf(err) }] };
  }

  const plan = planFolderScan(names);

  const imported: FolderScanImport[] = [];
  const failed: FolderScanFailure[] = plan.rejected.map((r) => ({
    file: r.file,
    year: yearFromFileName(r.file),
    reason: r.reason,
  }));

  // Em serie: cada import e uma transacao que reescreve um ano inteiro, e
  // dispara-las ao mesmo tempo contra a mesma base so compra contencao.
  for (const { file, year } of plan.toImport) {
    try {
      await importOne(folder, file, year, cookie);
      imported.push({ file, year });
    } catch (err) {
      if (err instanceof Unauthenticated) throw err;
      failed.push({ file, year, reason: messageOf(err) });
    }
  }

  return { imported, failed };
}

export async function POST(request: Request) {
  const folder = process.env.BUDGET_FOLDER;
  if (!folder) {
    return NextResponse.json({ status: "not-configured" } satisfies FolderScanResponse);
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force = body.force === true;

  if (cached && !force) {
    const response: FolderScanResponse = { status: "done", fromCache: true, ...cached };
    return NextResponse.json(response);
  }

  if (!inFlight || force) {
    const gen = ++generation;
    // Encadear no varrimento anterior em vez de lancar por cima dele: um
    // forcado a chegar enquanto outro ainda corre nao pode ter as duas
    // importacoes do mesmo ano em transacoes sobrepostas (duplicava linhas).
    // O generation counter continua a decidir quem escreve na cache.
    const previous = inFlight;
    inFlight = (previous ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => scan(folder, request.headers.get("cookie") ?? ""))
      .then((result) => {
        // So o varrimento mais recente pode escrever no cache: um varrimento
        // antigo a acabar depois de um forcado apagava dados mais frescos.
        if (gen === generation) cached = result;
        return result;
      });
  }
  const current = inFlight;

  try {
    const result = await current;
    const response: FolderScanResponse = { status: "done", fromCache: false, ...result };
    return NextResponse.json(response);
  } catch (err) {
    // Sem sessao, o resultado nao fica guardado -- senao uma corrida entre a
    // pagina e o cookie condenava o utilizador a um arranque vazio ate
    // reiniciar o Next.
    if (err instanceof Unauthenticated) {
      return NextResponse.json({ status: "unauthenticated" } satisfies FolderScanResponse);
    }
    const response: FolderScanResponse = {
      status: "done",
      fromCache: false,
      imported: [],
      failed: [{ file: folder, year: null, reason: messageOf(err) }],
    };
    return NextResponse.json(response);
  } finally {
    if (inFlight === current) inFlight = null;
  }
}
