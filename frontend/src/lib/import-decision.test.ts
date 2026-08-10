import { describe, it, expect } from "vitest";
import { decideImport } from "./import-decision";

describe("decideImport", () => {
  it("um ano vazio importa directamente", () => {
    expect(
      decideImport({ fileName: "2026.xlsx", yearHasData: false, busy: false })
    ).toEqual({ action: "import" });
  });

  it("um ano com dados passa pelo preview", () => {
    // E o passo que impede substituir 2026 pela folha de 2025 sem dar por isso.
    expect(
      decideImport({ fileName: "2025.xlsx", yearHasData: true, busy: false })
    ).toEqual({ action: "preview" });
  });

  it("recusa ficheiros que nao sejam .xlsx", () => {
    const d = decideImport({
      fileName: "extrato.csv",
      yearHasData: false,
      busy: false,
    });
    expect(d.action).toBe("reject");
  });

  it("aceita a extensao em maiusculas", () => {
    expect(
      decideImport({ fileName: "2026.XLSX", yearHasData: false, busy: false })
    ).toEqual({ action: "import" });
  });

  it("recusa um ficheiro sem extensao nenhuma", () => {
    expect(
      decideImport({ fileName: "2026", yearHasData: false, busy: false }).action
    ).toBe("reject");
  });

  it("recusa enquanto ja estiver a importar", () => {
    // Dois imports ao mesmo tempo sobre o mesmo ano apagavam-se um ao outro.
    const d = decideImport({
      fileName: "2026.xlsx",
      yearHasData: false,
      busy: true,
    });
    expect(d.action).toBe("reject");
  });

  it("estar ocupado ganha a extensao invalida", () => {
    const d = decideImport({
      fileName: "extrato.csv",
      yearHasData: false,
      busy: true,
    });
    expect(d).toEqual({ action: "reject", reason: "Already importing" });
  });
});
