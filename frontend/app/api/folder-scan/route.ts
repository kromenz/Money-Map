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
  const buffer = await readFile(path.join(folder, file));

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
    inFlight = scan(folder, request.headers.get("cookie") ?? "");
  }
  const current = inFlight;

  try {
    const result = await current;
    cached = result;
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
