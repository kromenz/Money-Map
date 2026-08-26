import { describe, it, expect } from "vitest";
import { sheetEdits, type StoredBridgeRow } from "./t212.sheet";

const row = (over: Partial<StoredBridgeRow> = {}): StoredBridgeRow => ({
  externalId: "t212:d-1",
  date: "2026-09-03",
  // Convencao de armazenamento: um deposito de 500 grava-se -500 em savings.
  amount: "-500.00",
  sheetAmount: null,
  section: "savings",
  group: "",
  name: "Savings and Investments",
  merchant: "Trading 212",
  ...over,
});

describe("sheetEdits", () => {
  it("uma linha por escrever leva o valor todo, no sinal da folha", () => {
    // O que o utilizador ve na folha e +500, nao o -500 com que a base o
    // guarda. E o mesmo desfazer que a grelha faz ao ler.
    const [edit] = sheetEdits([row()]);
    expect(edit).toMatchObject({ delta: "500.00", year: 2026, month: 9 });
  });

  it("uma linha ja escrita por inteiro nao produz edicao", () => {
    expect(sheetEdits([row({ sheetAmount: "-500.00" })])).toEqual([]);
  });

  it("o agregado dos juros que cresceu leva so a diferenca", () => {
    // A folha soma por incrementos. Escrever o total outra vez duplicava o que
    // ja la estava.
    const [edit] = sheetEdits([
      row({
        externalId: "t212:interest:2026-09",
        section: "income",
        name: "Interest",
        amount: "0.46",
        sheetAmount: "0.20",
      }),
    ]);
    expect(edit.delta).toBe("0.26");
  });

  it("devolve o total e nao o delta como valor a marcar", () => {
    // Marcar o delta deixava a conta a meio caminho se a marcacao se perdesse
    // -- a proxima corrida escrevia por cima do que ja estava na folha.
    const [edit] = sheetEdits([
      row({ externalId: "t212:interest:2026-09", section: "income", amount: "0.46", sheetAmount: "0.20" }),
    ]);
    expect(edit.amount).toBe("0.46");
  });

  it("uma linha que encolheu leva um delta negativo", () => {
    const [edit] = sheetEdits([
      row({ externalId: "t212:interest:2026-09", section: "income", amount: "0.20", sheetAmount: "0.46" }),
    ]);
    expect(edit.delta).toBe("-0.26");
  });

  it("o rotulo de um dividendo diz o titulo e o dia", () => {
    const [edit] = sheetEdits([
      row({ externalId: "t212:div-1", section: "income", merchant: "AAPL_US_EQ", date: "2026-09-15" }),
    ]);
    expect(edit.note).toBe("AAPL_US_EQ 2026-09-15");
  });

  it("o rotulo do agregado dos juros diz o mes", () => {
    const [edit] = sheetEdits([
      row({ externalId: "t212:interest:2026-09", section: "income", amount: "0.46" }),
    ]);
    expect(edit.note).toBe("T212 juros 2026-09");
  });

  it("o ano e o mes saem da data da linha", () => {
    const [edit] = sheetEdits([row({ date: "2025-01-31" })]);
    expect(edit).toMatchObject({ year: 2025, month: 1 });
  });
});
