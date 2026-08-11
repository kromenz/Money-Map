import type { FolderScanResponse } from "../types/folder-scan";

/**
 * Chama o route handler do proprio Next, nao a API. E por isso que nao usa o
 * cliente axios: esse aponta para a API e traz o interceptor de renovacao, que
 * aqui nao serve.
 */
export async function scanFolder(force: boolean): Promise<FolderScanResponse> {
  const res = await fetch("/api/folder-scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ force }),
  });

  if (!res.ok) throw new Error(`Folder scan failed (${res.status})`);
  return (await res.json()) as FolderScanResponse;
}
