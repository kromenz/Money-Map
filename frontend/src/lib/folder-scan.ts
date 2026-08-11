import { yearFromFileName } from "./year-from-filename";

export type PlannedFile = { file: string; year: number };
export type RejectedFile = { file: string; reason: string };

export type ScanPlan = {
  /** Por ordem crescente de ano. */
  toImport: PlannedFile[];
  rejected: RejectedFile[];
};

/**
 * Decide o que importar de uma pasta, a partir so dos nomes dos ficheiros.
 *
 * Nao toca no disco nem na rede de proposito: quem varre a pasta passa a lista
 * de nomes e recebe o plano, o que deixa esta regra testavel sem harness
 * nenhum.
 */
export function planFolderScan(fileNames: string[]): ScanPlan {
  const rejected: RejectedFile[] = [];
  const byYear = new Map<number, string[]>();

  for (const file of fileNames) {
    // Ficheiro de bloqueio que o Excel cria enquanto a folha esta aberta. Nao
    // e uma rejeicao: nomear-lo ao utilizador so seria ruido.
    if (file.startsWith("~$")) continue;
    if (!file.toLowerCase().endsWith(".xlsx")) continue;

    const year = yearFromFileName(file);
    if (year === null) {
      rejected.push({ file, reason: "no year in the file name" });
      continue;
    }

    const claimants = byYear.get(year);
    if (claimants) claimants.push(file);
    else byYear.set(year, [file]);
  }

  const toImport: PlannedFile[] = [];

  for (const [year, claimants] of byYear) {
    // Importar um ano apaga e reescreve o ano inteiro no backend. Com dois
    // ficheiros a reclamar o mesmo ano, o segundo apagaria o trabalho do
    // primeiro sem deixar sinal -- por isso nenhum entra.
    if (claimants.length > 1) {
      for (const file of claimants) {
        rejected.push({ file, reason: `${claimants.length} files claim ${year}` });
      }
      continue;
    }
    toImport.push({ file: claimants[0], year });
  }

  toImport.sort((a, b) => a.year - b.year);
  rejected.sort((a, b) => a.file.localeCompare(b.file));

  return { toImport, rejected };
}
