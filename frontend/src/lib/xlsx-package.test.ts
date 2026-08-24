import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { applyExpenses } from "./xlsx-package";
import { SheetTargetError } from "./sheet-locate";
import { parseBudgetWorkbook } from "../../../backend/src/modules/budget/budget.parser";

const bytes = () =>
  new Uint8Array(
    readFileSync(path.resolve(__dirname, "__fixtures__/budget-2026.xlsx"))
  );

async function firstExpenseCategory() {
  const parsed = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);

  // Nao chega escolher a primeira categoria de despesas com grupo
  // ("group !== \"\""): o primeiro grupo de despesas desta folha (Home) tem
  // subtotal zero em todos os meses, e o Excel omite o valor em cache de uma
  // formula cujo resultado e zero. Por isso o parser nunca regista
  // "expenses/Home" em checksums.groups, e locateCells devolve
  // groupSubtotal: null para essa categoria -- usar essa categoria faria o
  // teste dos checksums passar mesmo que a actualizacao do subtotal fosse
  // removida por completo, porque nao havia nenhum subtotal a comparar.
  // Por isso escolhe-se aqui uma categoria cujo grupo aparece de facto em
  // checksums.groups, derivado do proprio output do parser em vez de um nome
  // de grupo fixo no codigo, para nao apodrecer se a fixture mudar.
  const groupsWithChecksum = new Set(
    Object.keys(parsed.checksums.groups)
      .filter((key) => key.startsWith("expenses/"))
      .map((key) => key.slice("expenses/".length))
  );

  const c = parsed.categories.find(
    (x) => x.section === "expenses" && groupsWithChecksum.has(x.group)
  );
  if (!c) {
    throw new Error(
      "a fixture nao tem uma despesa num grupo com subtotal registado em checksums.groups"
    );
  }
  return c;
}

/**
 * O inverso de firstExpenseCategory: uma categoria de despesas cujo grupo NAO
 * tem subtotal em checksums.groups -- ou seja, groupSubtotal e null por
 * design, nao por falta de procura. Serve para testar o outro lado do "if
 * (found.groupSubtotal)" em applyExpenses: que um subtotal ausente e
 * ignorado em silencio, e nao rebenta o pedido inteiro.
 */
async function firstNullSubtotalExpenseCategory() {
  const parsed = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);

  const groupsWithChecksum = new Set(
    Object.keys(parsed.checksums.groups)
      .filter((key) => key.startsWith("expenses/"))
      .map((key) => key.slice("expenses/".length))
  );

  const c = parsed.categories.find(
    (x) => x.section === "expenses" && x.group !== "" && !groupsWithChecksum.has(x.group)
  );
  if (!c) {
    throw new Error(
      "a fixture nao tem uma despesa num grupo sem subtotal registado em checksums.groups"
    );
  }
  return c;
}

describe("applyExpenses", () => {
  it("preserva todas as partes excepto as quatro que muda", async () => {
    const before = unzipSync(bytes());
    const target = await firstExpenseCategory();

    const after = unzipSync(
      await applyExpenses(bytes(), [{ ...target, month: 3, amount: 12.5 }])
    );

    const untouched = Object.keys(before).filter(
      (name) =>
        name !== "xl/worksheets/sheet1.xml" &&
        name !== "xl/workbook.xml" &&
        name !== "xl/calcChain.xml" &&
        name !== "[Content_Types].xml" &&
        name !== "xl/_rels/workbook.xml.rels"
    );

    for (const name of untouched) {
      expect(Buffer.from(after[name])).toEqual(Buffer.from(before[name]));
    }
  });

  it("os graficos saem byte a byte iguais", async () => {
    // E isto que uma regravacao com ExcelJS destruiria. O teste existe para a
    // proxima pessoa nao ser tentada a simplificar por ai.
    const before = unzipSync(bytes());
    const target = await firstExpenseCategory();

    const after = unzipSync(
      await applyExpenses(bytes(), [{ ...target, month: 3, amount: 12.5 }])
    );

    expect(Buffer.from(after["xl/charts/chart1.xml"])).toEqual(
      Buffer.from(before["xl/charts/chart1.xml"])
    );
    expect(Buffer.from(after["xl/charts/chart2.xml"])).toEqual(
      Buffer.from(before["xl/charts/chart2.xml"])
    );
    expect(after["xl/drawings/drawing1.xml"]).toBeDefined();
  });

  it("remove o calcChain e a sua entrada no Content_Types", async () => {
    const target = await firstExpenseCategory();
    const after = unzipSync(
      await applyExpenses(bytes(), [{ ...target, month: 3, amount: 12.5 }])
    );

    expect(after["xl/calcChain.xml"]).toBeUndefined();

    const types = new TextDecoder().decode(after["[Content_Types].xml"]);
    expect(types).not.toContain("calcChain");
  });

  it("remove a Relationship do calcChain sem tocar nas outras", async () => {
    // Sem isto o zip fica com uma Relationship a apontar para um
    // calcChain.xml que ja nao existe -- uma violacao do OPC que o Excel
    // apanha ao abrir e mostra como "encontramos um problema com algum
    // conteudo".
    const before = unzipSync(bytes());
    const target = await firstExpenseCategory();
    const after = unzipSync(
      await applyExpenses(bytes(), [{ ...target, month: 3, amount: 12.5 }])
    );

    const relsBefore = new TextDecoder().decode(before["xl/_rels/workbook.xml.rels"]);
    const relsAfter = new TextDecoder().decode(after["xl/_rels/workbook.xml.rels"]);

    expect(relsBefore).toContain("calcChain");
    expect(relsAfter).not.toContain("calcChain");

    // As outras relacoes continuam la, incluindo a da propria folha.
    expect(relsAfter).toContain("worksheets/sheet1.xml");
    expect(relsAfter).toContain("sharedStrings.xml");
    expect(relsAfter).toContain("styles.xml");
    expect(relsAfter).toContain("theme/theme1.xml");
  });

  it("poe fullCalcOnLoad sem perder o calcId", async () => {
    const target = await firstExpenseCategory();
    const after = unzipSync(
      await applyExpenses(bytes(), [{ ...target, month: 3, amount: 12.5 }])
    );

    const workbook = new TextDecoder().decode(after["xl/workbook.xml"]);
    expect(workbook).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
    expect(workbook).toMatch(/<calcPr[^>]*calcId="\d+"/);
  });

  it("o parser real ve o valor novo", async () => {
    const target = await firstExpenseCategory();
    const written = await applyExpenses(bytes(), [
      { ...target, month: 3, amount: 12.5 },
    ]);

    const before = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
    const after = await parseBudgetWorkbook(Buffer.from(written), 2026);

    const find = (p: typeof before) =>
      p.cells.find(
        (c) =>
          c.section === target.section &&
          c.group === target.group &&
          c.name === target.name &&
          c.month === 3
      )?.sheetValue ?? 0;

    expect(find(after) - find(before)).toBeCloseTo(12.5, 2);
  });

  it("actualiza o subtotal do grupo pelo valor exacto do gasto", async () => {
    // Prova directa do caminho do subtotal: se a actualizacao do subtotal
    // fosse removida de applyExpenses, o valor em cache da linha de subtotal
    // nao se mexia e este teste falhava, mesmo que a celula da categoria em
    // si estivesse correcta.
    const target = await firstExpenseCategory();
    const written = await applyExpenses(bytes(), [
      { ...target, month: 3, amount: 12.5 },
    ]);

    const before = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
    const after = await parseBudgetWorkbook(Buffer.from(written), 2026);

    const key = `${target.section}/${target.group}`;
    const beforeValue = before.checksums.groups[key]?.months[3 - 1];
    const afterValue = after.checksums.groups[key]?.months[3 - 1];

    expect(beforeValue).not.toBeNull();
    expect(beforeValue).not.toBeUndefined();
    expect(afterValue).not.toBeNull();
    expect(afterValue).not.toBeUndefined();

    expect((afterValue as number) - (beforeValue as number)).toBeCloseTo(12.5, 2);
  });

  it("os checksums continuam a bater depois de escrever", async () => {
    // O teste que garante que um gasto registado nao faz o import seguinte
    // devolver 422. Se este falhar, os subtotais nao foram actualizados.
    const target = await firstExpenseCategory();
    const written = await applyExpenses(bytes(), [
      { ...target, month: 3, amount: 12.5 },
    ]);

    const parsed = await parseBudgetWorkbook(Buffer.from(written), 2026);

    for (const [key, declared] of Object.entries(parsed.checksums.groups)) {
      const [section, group] = key.split("/");
      for (let month = 1; month <= 12; month += 1) {
        const sheet = declared.months[month - 1];
        if (sheet === null) continue;

        const sum = parsed.cells
          .filter(
            (c) => c.section === section && c.group === group && c.month === month
          )
          .reduce((a, c) => a + c.sheetValue, 0);

        expect(Math.abs(sum - sheet)).toBeLessThanOrEqual(0.005);
      }
    }

    for (const section of ["income", "savings", "expenses"] as const) {
      const declared = parsed.checksums.sections[section].months;
      for (let month = 1; month <= 12; month += 1) {
        const sheet = declared[month - 1];
        if (sheet === null) continue;

        const sum = parsed.cells
          .filter((c) => c.section === section && c.month === month)
          .reduce((a, c) => a + c.sheetValue, 0);

        expect(Math.abs(sum - sheet)).toBeLessThanOrEqual(0.005);
      }
    }
  });

  it("aplica varios gastos de uma so vez", async () => {
    const target = await firstExpenseCategory();
    const written = await applyExpenses(bytes(), [
      { ...target, month: 3, amount: 10 },
      { ...target, month: 3, amount: 2.5 },
    ]);

    const before = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
    const after = await parseBudgetWorkbook(Buffer.from(written), 2026);

    const find = (p: typeof before) =>
      p.cells.find(
        (c) =>
          c.section === target.section &&
          c.group === target.group &&
          c.name === target.name &&
          c.month === 3
      )?.sheetValue ?? 0;

    expect(find(after) - find(before)).toBeCloseTo(12.5, 2);
  });

  it("escreve numa categoria sem subtotal de grupo (Home) sem falhar", async () => {
    // O grupo Home tem subtotal zero em todos os meses, e o Excel omite o
    // valor em cache de uma formula cujo resultado e zero -- por isso essa
    // linha nao tem <v> na folha, o parser nunca a regista em
    // checksums.groups, e locateCells devolve groupSubtotal: null para
    // qualquer categoria dentro dele. Isto e comportamento deliberado, nao
    // um buraco: applyExpenses tem de saltar esse subtotal em silencio (o
    // "if (found.groupSubtotal)"), e nao rebentar o pedido so porque um
    // grupo nao tem nada para comparar.
    const target = await firstNullSubtotalExpenseCategory();
    expect(target.group).toBe("Home");

    const written = await applyExpenses(bytes(), [
      { ...target, month: 3, amount: 12.5 },
    ]);

    const before = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
    const after = await parseBudgetWorkbook(Buffer.from(written), 2026);

    const findCell = (p: typeof before) =>
      p.cells.find(
        (c) =>
          c.section === target.section &&
          c.group === target.group &&
          c.name === target.name &&
          c.month === 3
      )?.sheetValue ?? 0;

    expect(findCell(after) - findCell(before)).toBeCloseTo(12.5, 2);

    const sectionBefore = before.checksums.sections.expenses.months[3 - 1];
    const sectionAfter = after.checksums.sections.expenses.months[3 - 1];
    expect(sectionBefore).not.toBeNull();
    expect(sectionAfter).not.toBeNull();
    expect((sectionAfter as number) - (sectionBefore as number)).toBeCloseTo(12.5, 2);
  });

  it("propaga o erro de uma categoria que nao existe", async () => {
    await expect(
      applyExpenses(bytes(), [
        {
          section: "expenses",
          group: "Home",
          name: "Nao existe",
          month: 3,
          amount: 1,
        },
      ])
    ).rejects.toThrow(SheetTargetError);
  });
});
