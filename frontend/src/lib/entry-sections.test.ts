import { describe, it, expect } from "vitest";
import { sectionsPresent, defaultSection, addLabel } from "./entry-sections";
import type { GridRow } from "@/types/budget";

const row = (section: GridRow["section"], name: string): GridRow => ({
  categoryId: `${section}/${name}`,
  section,
  group: "",
  name,
  months: [],
  total: "0",
});

describe("sectionsPresent", () => {
  it("devolve as tres quando a folha tem as tres", () => {
    expect(
      sectionsPresent([
        row("expenses", "Rent"),
        row("income", "Salary"),
        row("savings", "Emergency Fund"),
      ])
    ).toEqual(["income", "savings", "expenses"]);
  });

  it("a ordem e sempre a da folha, nao a das linhas", () => {
    // A grelha ordena por seccao alfabetica (expenses, income, savings), que
    // nao e a ordem por que a folha esta escrita. Os botoes tem de sair pela
    // ordem a que ele olha no Excel.
    expect(
      sectionsPresent([row("savings", "S"), row("expenses", "E"), row("income", "I")])
    ).toEqual(["income", "savings", "expenses"]);
  });

  it("uma seccao sem linhas nao aparece", () => {
    // Nem toda a folha tem Savings. Um botao que filtra para uma lista vazia
    // e um botao que so faz o utilizador perguntar-se o que fez de errado.
    expect(sectionsPresent([row("expenses", "Rent"), row("income", "Salary")])).toEqual([
      "income",
      "expenses",
    ]);
  });

  it("so despesas da uma seccao so, que e o sinal para nao desenhar a fila", () => {
    expect(sectionsPresent([row("expenses", "Rent")])).toEqual(["expenses"]);
  });

  it("sem linhas nao ha seccoes", () => {
    expect(sectionsPresent([])).toEqual([]);
  });

  it("nao repete a seccao de varias linhas", () => {
    const out = sectionsPresent([
      row("income", "Salary"),
      row("income", "Dividends"),
      row("income", "Interest"),
    ]);
    expect(out).toEqual(["income"]);
  });
});

describe("defaultSection", () => {
  it("abre em despesas, que e o caso do dia-a-dia", () => {
    expect(
      defaultSection([row("income", "Salary"), row("expenses", "Rent")])
    ).toBe("expenses");
  });

  it("sem despesas cai na primeira que a folha tenha", () => {
    expect(defaultSection([row("savings", "Fund"), row("income", "Salary")])).toBe(
      "income"
    );
  });

  it("com uma seccao so, e essa", () => {
    expect(defaultSection([row("savings", "Fund")])).toBe("savings");
  });

  it("sem linhas nao ha escolha nenhuma", () => {
    // A barra esconde-se sozinha neste caso, mas a funcao tem de conseguir
    // dize-lo sem inventar uma seccao que a folha nao tem.
    expect(defaultSection([])).toBeNull();
  });
});

describe("addLabel", () => {
  it("nomeia o que o botao vai escrever", () => {
    expect(addLabel("expenses")).toBe("Add expense");
    expect(addLabel("income")).toBe("Add income");
    expect(addLabel("savings")).toBe("Add saving");
  });
});
