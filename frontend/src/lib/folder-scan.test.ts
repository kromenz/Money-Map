import { describe, it, expect } from "vitest";
import { planFolderScan } from "./folder-scan";

describe("planFolderScan", () => {
  it("aceita um ficheiro com o ano no nome", () => {
    const plan = planFolderScan(["2026.xlsx"]);
    expect(plan.toImport).toEqual([{ file: "2026.xlsx", year: 2026 }]);
    expect(plan.rejected).toEqual([]);
  });

  it("rejeita um ficheiro sem ano no nome", () => {
    const plan = planFolderScan(["notas.xlsx"]);
    expect(plan.toImport).toEqual([]);
    expect(plan.rejected).toEqual([
      { file: "notas.xlsx", reason: "no year in the file name" },
    ]);
  });

  it("ignora o ficheiro de bloqueio do Excel sem o dar como rejeitado", () => {
    const plan = planFolderScan(["~$2026.xlsx", "2026.xlsx"]);
    expect(plan.toImport).toEqual([{ file: "2026.xlsx", year: 2026 }]);
    expect(plan.rejected).toEqual([]);
  });

  it("ignora ficheiros que nao sao xlsx", () => {
    const plan = planFolderScan(["2026.txt", "2026.csv", "notas.pdf"]);
    expect(plan.toImport).toEqual([]);
    expect(plan.rejected).toEqual([]);
  });

  it("aceita a extensao em maiusculas", () => {
    const plan = planFolderScan(["2026.XLSX"]);
    expect(plan.toImport).toEqual([{ file: "2026.XLSX", year: 2026 }]);
  });

  it("rejeita todos os ficheiros que reclamam o mesmo ano", () => {
    const plan = planFolderScan(["2026.xlsx", "orcamento-2026.xlsx"]);
    expect(plan.toImport).toEqual([]);
    expect(plan.rejected).toEqual([
      { file: "2026.xlsx", reason: "2 files claim 2026" },
      { file: "orcamento-2026.xlsx", reason: "2 files claim 2026" },
    ]);
  });

  it("uma colisao num ano nao impede os outros anos de entrar", () => {
    const plan = planFolderScan(["2025.xlsx", "2026.xlsx", "copia-2026.xlsx"]);
    expect(plan.toImport).toEqual([{ file: "2025.xlsx", year: 2025 }]);
    expect(plan.rejected).toHaveLength(2);
  });

  it("ordena por ano crescente", () => {
    const plan = planFolderScan(["2026.xlsx", "2024.xlsx", "2025.xlsx"]);
    expect(plan.toImport.map((p) => p.year)).toEqual([2024, 2025, 2026]);
  });

  it("uma pasta vazia da dois arrays vazios", () => {
    expect(planFolderScan([])).toEqual({ toImport: [], rejected: [] });
  });
});
