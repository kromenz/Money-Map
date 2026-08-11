import { describe, it, expect } from "vitest";
import { decideImport } from "./import-decision";

describe("decideImport", () => {
  it("um ano vazio importa directamente", () => {
    expect(
      decideImport({
        fileName: "2026.xlsx",
        viewedYear: 2026,
        yearsWithData: [],
        busy: false,
      })
    ).toEqual({ action: "import", year: 2026 });
  });

  it("um ano com dados passa pelo preview", () => {
    // E o passo que impede substituir 2025 pela folha errada sem dar por isso.
    expect(
      decideImport({
        fileName: "2025.xlsx",
        viewedYear: 2025,
        yearsWithData: [2025],
        busy: false,
      })
    ).toEqual({ action: "preview", year: 2025 });
  });

  it("o ano vem do nome do ficheiro, nao do que esta a ser visto", () => {
    expect(
      decideImport({
        fileName: "2027.xlsx",
        viewedYear: 2026,
        yearsWithData: [2026],
        busy: false,
      })
    ).toEqual({ action: "import", year: 2027 });
  });

  it("um ficheiro de outro ano que ja tem dados passa pelo preview desse ano", () => {
    expect(
      decideImport({
        fileName: "2027.xlsx",
        viewedYear: 2026,
        yearsWithData: [2026, 2027],
        busy: false,
      })
    ).toEqual({ action: "preview", year: 2027 });
  });

  it("sem ano no nome fica o ano que esta a ser visto", () => {
    expect(
      decideImport({
        fileName: "download.xlsx",
        viewedYear: 2026,
        yearsWithData: [],
        busy: false,
      })
    ).toEqual({ action: "import", year: 2026 });
  });

  it("com a lista de anos por chegar assume que o ano tem dados", () => {
    // Assumir o contrario abria uma janela em que largar um ficheiro
    // substituia um ano cheio sem confirmacao nenhuma.
    expect(
      decideImport({
        fileName: "2030.xlsx",
        viewedYear: 2026,
        yearsWithData: undefined,
        busy: false,
      })
    ).toEqual({ action: "preview", year: 2030 });
  });

  it("recusa ficheiros que nao sejam .xlsx", () => {
    const d = decideImport({
      fileName: "extrato.csv",
      viewedYear: 2026,
      yearsWithData: [],
      busy: false,
    });
    expect(d.action).toBe("reject");
  });

  it("aceita a extensao em maiusculas", () => {
    expect(
      decideImport({
        fileName: "2026.XLSX",
        viewedYear: 2026,
        yearsWithData: [],
        busy: false,
      })
    ).toEqual({ action: "import", year: 2026 });
  });

  it("recusa um ficheiro sem extensao nenhuma", () => {
    expect(
      decideImport({
        fileName: "2026",
        viewedYear: 2026,
        yearsWithData: [],
        busy: false,
      }).action
    ).toBe("reject");
  });

  it("recusa enquanto ja estiver a importar", () => {
    // Dois imports ao mesmo tempo sobre o mesmo ano apagavam-se um ao outro.
    const d = decideImport({
      fileName: "2026.xlsx",
      viewedYear: 2026,
      yearsWithData: [],
      busy: true,
    });
    expect(d.action).toBe("reject");
  });

  it("estar ocupado ganha a extensao invalida", () => {
    // Igualdade exacta de proposito: distingue QUAL das duas verificacoes
    // disparou, que e o que este teste existe para provar.
    const d = decideImport({
      fileName: "extrato.csv",
      viewedYear: 2026,
      yearsWithData: [],
      busy: true,
    });
    expect(d).toEqual({ action: "reject", reason: "Already importing" });
  });
});
