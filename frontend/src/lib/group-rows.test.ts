import { describe, it, expect } from "vitest";
import { groupRows } from "./group-rows";
import type { GridRow } from "../types/budget";

function row(group: string, name: string): GridRow {
  return {
    categoryId: `${group}-${name}`,
    section: "expenses",
    group,
    name,
    months: Array.from({ length: 12 }, () => "0.00"),
    total: "0.00",
  };
}

describe("groupRows", () => {
  it("junta linhas do mesmo grupo que vem seguidas", () => {
    const out = groupRows([
      row("Transportation", "Fuel"),
      row("Transportation", "Insurance"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].group).toBe("Transportation");
    expect(out[0].rows.map((r) => r.name)).toEqual(["Fuel", "Insurance"]);
  });

  it("junta linhas do mesmo grupo mesmo separadas por outro grupo", () => {
    // O sortOrder e um indice por folha, atribuido quando a categoria e criada.
    // Importar um segundo ano so cria as categorias que faltam, e essas recebem
    // indices da numeracao da outra folha -- por isso as linhas de um grupo
    // deixam de vir seguidas. Duas corridas do mesmo grupo davam duas chaves
    // iguais no React.
    const out = groupRows([
      row("Transportation", "Fuel"),
      row("Housing", "Rent"),
      row("Transportation", "Insurance"),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((g) => g.group)).toEqual(["Transportation", "Housing"]);
    expect(out[0].rows.map((r) => r.name)).toEqual(["Fuel", "Insurance"]);
  });

  it("nao repete um grupo, seja qual for a ordem de chegada", () => {
    const out = groupRows([
      row("A", "1"),
      row("B", "2"),
      row("A", "3"),
      row("B", "4"),
      row("A", "5"),
    ]);
    expect(out.map((g) => g.group)).toEqual(["A", "B"]);
    expect(new Set(out.map((g) => g.group)).size).toBe(out.length);
  });

  it("mantem a ordem da primeira aparicao de cada grupo", () => {
    const out = groupRows([
      row("Zulu", "1"),
      row("Alpha", "2"),
      row("Zulu", "3"),
    ]);
    expect(out.map((g) => g.group)).toEqual(["Zulu", "Alpha"]);
  });

  it("trata as categorias sem grupo como um grupo proprio", () => {
    const out = groupRows([row("", "Solta"), row("Housing", "Rent"), row("", "Outra")]);
    expect(out.map((g) => g.group)).toEqual(["", "Housing"]);
    expect(out[0].rows.map((r) => r.name)).toEqual(["Solta", "Outra"]);
  });

  it("uma lista vazia da uma lista vazia", () => {
    expect(groupRows([])).toEqual([]);
  });
});
