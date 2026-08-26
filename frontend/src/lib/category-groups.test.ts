import { describe, it, expect } from "vitest";
import { groupCategories } from "./category-groups";
import type { GridRow } from "@/types/budget";

const row = (group: string, name: string, id = `${group}/${name}`): GridRow => ({
  categoryId: id,
  section: "expenses",
  group,
  name,
  months: [],
  total: "0",
});

describe("groupCategories", () => {
  it("junta as categorias de cada grupo", () => {
    const out = groupCategories([
      row("Home", "Rent"),
      row("Home", "Utilities"),
      row("Transportation", "Fuel"),
    ]);

    expect(out).toEqual([
      { group: "Home", items: [
        { value: "Home/Rent", label: "Rent" },
        { value: "Home/Utilities", label: "Utilities" },
      ] },
      { group: "Transportation", items: [{ value: "Transportation/Fuel", label: "Fuel" }] },
    ]);
  });

  it("um grupo em dois trocos separados da UM bloco so", () => {
    // O defeito verdadeiro: as categorias nao chegam com os grupos todos
    // seguidos -- as que sobraram de importacoes antigas intercalam-se pelo
    // sortOrder. A versao ingenua abria dois blocos com a mesma chave e o
    // React recusava com "two children with the same key".
    const out = groupCategories([
      row("Personal and Family", "Gym"),
      row("Other", "Miscellaneous"),
      row("Personal and Family", "Temu"),
    ]);

    expect(out.map((g) => g.group)).toEqual(["Personal and Family", "Other"]);
    expect(out[0].items.map((i) => i.label)).toEqual(["Gym", "Temu"]);
  });

  it("as chaves dos grupos sao unicas, que e o que o React exige", () => {
    const out = groupCategories([
      row("A", "1"), row("B", "2"), row("A", "3"), row("B", "4"), row("A", "5"),
    ]);
    expect(new Set(out.map((g) => g.group)).size).toBe(out.length);
  });

  it("a ordem e a da primeira aparicao de cada grupo", () => {
    const out = groupCategories([row("Z", "1"), row("A", "2"), row("Z", "3")]);
    expect(out.map((g) => g.group)).toEqual(["Z", "A"]);
  });

  it("o grupo vazio e um grupo como os outros", () => {
    // As categorias fora de qualquer grupo existem na folha; o cabecalho e que
    // nao se desenha para elas.
    const out = groupCategories([row("", "Dividends")]);
    expect(out).toEqual([{ group: "", items: [{ value: "/Dividends", label: "Dividends" }] }]);
  });

  it("sem categorias nao ha grupos", () => {
    expect(groupCategories([])).toEqual([]);
  });
});
