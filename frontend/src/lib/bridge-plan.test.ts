import { describe, it, expect } from "vitest";
import { groupEditsByYear } from "./bridge-plan";
import type { SheetEdit } from "@/types/bridge";

const edit = (over: Partial<SheetEdit> = {}): SheetEdit => ({
  externalId: "t212:d-1",
  year: 2026,
  month: 9,
  section: "savings",
  group: "",
  name: "Trading 212",
  delta: "500.00",
  note: "Trading 212 2026-09-03",
  amount: "-500.00",
  ...over,
});

describe("groupEditsByYear", () => {
  it("junta as parcelas do mesmo ano num lote so", () => {
    // Cada lote reescreve o ficheiro inteiro e corre um import completo. Um
    // lote por parcela pagava isso N vezes sem ganho nenhum.
    const batches = groupEditsByYear([edit(), edit({ externalId: "t212:d-2" })]);
    expect(batches).toHaveLength(1);
    expect(batches[0].expenses).toHaveLength(2);
  });

  it("separa anos diferentes e devolve-os por ordem", () => {
    const batches = groupEditsByYear([edit({ year: 2027 }), edit({ year: 2025 })]);
    expect(batches.map((b) => b.year)).toEqual([2025, 2027]);
  });

  it("o delta vai para o applyExpenses, nao o total da linha", () => {
    // O amount e a convencao de armazenamento e serve para marcar no servidor;
    // o que a celula soma e o delta, na convencao da folha.
    const [batch] = groupEditsByYear([edit({ delta: "0.26", amount: "0.46" })]);
    expect(batch.expenses[0].amount).toBe(0.26);
    expect(batch.written[0].amount).toBe("0.46");
  });

  it("a etiqueta acompanha a parcela ate a folha", () => {
    const [batch] = groupEditsByYear([edit({ note: "AAPL_US_EQ 2026-09-15" })]);
    expect(batch.expenses[0].note).toBe("AAPL_US_EQ 2026-09-15");
  });

  it("um delta de zero nao produz escrita nenhuma", () => {
    // "+0" na formula sujava-a para sempre sem mudar valor nenhum.
    expect(groupEditsByYear([edit({ delta: "0.00" })])).toEqual([]);
  });

  it("um delta que nao e numero nao passa", () => {
    expect(groupEditsByYear([edit({ delta: "" })])).toEqual([]);
  });

  it("um delta negativo passa -- uma linha pode encolher", () => {
    const [batch] = groupEditsByYear([edit({ delta: "-0.26" })]);
    expect(batch.expenses[0].amount).toBe(-0.26);
  });

  it("o que volta ao servidor emparelha com o que foi escrito", () => {
    const [batch] = groupEditsByYear([
      edit({ externalId: "t212:a" }),
      edit({ externalId: "t212:b" }),
    ]);
    expect(batch.written.map((w) => w.externalId)).toEqual(["t212:a", "t212:b"]);
  });
});
