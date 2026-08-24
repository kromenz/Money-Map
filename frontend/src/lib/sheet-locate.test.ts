import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { columnLetter, locateCells, SheetTargetError } from "./sheet-locate";
import { parseBudgetWorkbook } from "../../../backend/src/modules/budget/budget.parser";

const bytes = () =>
  new Uint8Array(
    readFileSync(path.resolve(__dirname, "__fixtures__/budget-2026.xlsx"))
  );

describe("columnLetter", () => {
  it("Janeiro e a coluna C", () => {
    expect(columnLetter(1)).toBe("C");
  });

  it("Dezembro e a coluna N", () => {
    expect(columnLetter(12)).toBe("N");
  });

  it("recusa um mes fora da gama", () => {
    expect(() => columnLetter(0)).toThrow(SheetTargetError);
    expect(() => columnLetter(13)).toThrow(SheetTargetError);
  });
});

describe("locateCells", () => {
  it("resolve todas as categorias da fixture, uma a uma", async () => {
    // Este e o teste que cobre o unico erro que a verificacao do import nao
    // apanha: escrever na categoria errada dentro do mesmo grupo. O parser diz
    // que categorias existem; o localizador tem de as encontrar a todas, e
    // cada uma numa linha diferente.
    const file = bytes();
    const parsed = await parseBudgetWorkbook(Buffer.from(file), 2026);

    const rows = new Set<string>();
    for (const c of parsed.categories) {
      const found = await locateCells(file, { ...c, month: 1 });
      expect(found.cell).toMatch(/^C\d+$/);
      rows.add(found.cell);
    }

    expect(rows.size).toBe(parsed.categories.length);
  });

  it("a celula muda de coluna com o mes e nao de linha", async () => {
    const file = bytes();
    const parsed = await parseBudgetWorkbook(Buffer.from(file), 2026);
    const first = parsed.categories[0];

    const jan = await locateCells(file, { ...first, month: 1 });
    const dez = await locateCells(file, { ...first, month: 12 });

    expect(jan.cell.slice(1)).toBe(dez.cell.slice(1));
    expect(jan.cell[0]).toBe("C");
    expect(dez.cell[0]).toBe("N");
  });

  it("devolve as linhas de subtotal na mesma coluna do mes", async () => {
    const file = bytes();
    const parsed = await parseBudgetWorkbook(Buffer.from(file), 2026);
    const withGroup = parsed.categories.find((c) => c.group !== "");
    expect(withGroup).toBeDefined();

    const found = await locateCells(file, { ...withGroup!, month: 5 });

    expect(found.cell[0]).toBe("G");
    expect(found.groupSubtotal?.[0]).toBe("G");
    expect(found.sectionTotal?.[0]).toBe("G");
    // Um subtotal esta sempre abaixo da categoria que o alimenta.
    expect(Number(found.groupSubtotal!.slice(1))).toBeGreaterThan(
      Number(found.cell.slice(1))
    );
  });

  it("recusa uma categoria que a folha nao tem", async () => {
    await expect(
      locateCells(bytes(), {
        section: "expenses",
        group: "Home",
        name: "Nao existe",
        month: 3,
      })
    ).rejects.toThrow(SheetTargetError);
  });

  it("recusa a categoria certa na seccao errada", async () => {
    const file = bytes();
    const parsed = await parseBudgetWorkbook(Buffer.from(file), 2026);
    const expense = parsed.categories.find((c) => c.section === "expenses")!;

    await expect(
      locateCells(file, { ...expense, section: "income", month: 3 })
    ).rejects.toThrow(SheetTargetError);
  });
});
