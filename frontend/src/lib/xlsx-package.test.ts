import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";
import { applyExpenses, MultiSheetError } from "./xlsx-package";
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

  it("recusa escrever quando o workbook tem mais de uma folha", async () => {
    // Copia modificada da fixture: acrescenta um segundo <sheet> declarado no
    // workbook.xml, sem tocar em mais nada. E o cenario que xlsx-package.ts
    // hoje assume nunca acontecer -- SHEET aponta sempre para sheet1.xml,
    // enquanto locateCells resolve por wb.worksheets[0]. Os dois so coincidem
    // porque ha um separador so; isto simula deixar de ser verdade.
    const files = unzipSync(bytes());
    const workbookXml = new TextDecoder().decode(files["xl/workbook.xml"]);
    expect(workbookXml).toContain('<sheet name="Personal Budget" sheetId="1" r:id="rId1"/>');

    const withSecondSheet = workbookXml.replace(
      '<sheet name="Personal Budget" sheetId="1" r:id="rId1"/>',
      '<sheet name="Personal Budget" sheetId="1" r:id="rId1"/><sheet name="Extra" sheetId="2" r:id="rId99"/>'
    );
    expect(withSecondSheet).not.toBe(workbookXml);
    files["xl/workbook.xml"] = new TextEncoder().encode(withSecondSheet);

    const target = await firstExpenseCategory();
    await expect(
      applyExpenses(zipSync(files), [{ ...target, month: 3, amount: 12.5 }])
    ).rejects.toThrow(MultiSheetError);
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

/**
 * Regressao com a fixture 2025 (celulas de mes com placeholder "-").
 *
 * A fixture 2026 nao consegue cobrir o defeito do t="s" (ver sheet-write.ts,
 * cachedValue/editFormulaCell): nenhuma das suas celulas de categoria e uma
 * celula de texto. A fixture 2025 vem de um .xlsx real onde Janeiro-Outubro
 * usam "-" (shared string) como marcador de mes sem movimento em todas as
 * categorias de despesa; so Novembro/Dezembro tem numeros reais. Escrever um
 * gasto num desses meses de placeholder e exactamente o caminho que rebentava:
 * cachedValue lia o indice da shared string como se fosse um montante.
 */
describe("applyExpenses, fixture 2025 (celulas de placeholder \"-\")", () => {
  const bytes2025 = () =>
    new Uint8Array(
      readFileSync(path.resolve(__dirname, "__fixtures__/budget-2025.xlsx"))
    );

  async function expenseCategoryWithGroupChecksum() {
    const parsed = await parseBudgetWorkbook(Buffer.from(bytes2025()), 2025);

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
        "a fixture 2025 nao tem uma despesa num grupo com subtotal registado em checksums.groups"
      );
    }
    return c;
  }

  it("um gasto em Janeiro (celula de placeholder) mantem os checksums a bater", async () => {
    // Antes da correccao em sheet-write.ts, isto falhava: a categoria ganhava
    // o indice da shared string do "-" (59) somado ao delta em vez de so o
    // delta, os subtotais so ganhavam o delta, e a soma das celulas deixava de
    // bater com o subtotal declarado pela propria folha.
    const target = await expenseCategoryWithGroupChecksum();
    const written = await applyExpenses(bytes2025(), [
      { ...target, month: 1, amount: 5 },
    ]);

    const parsed = await parseBudgetWorkbook(Buffer.from(written), 2025);

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

  it("o valor novo da categoria e exactamente o delta, nao delta + indice da shared string", async () => {
    const target = await expenseCategoryWithGroupChecksum();
    const written = await applyExpenses(bytes2025(), [
      { ...target, month: 1, amount: 5 },
    ]);

    const before = await parseBudgetWorkbook(Buffer.from(bytes2025()), 2025);
    const after = await parseBudgetWorkbook(Buffer.from(written), 2025);

    const find = (p: typeof before) =>
      p.cells.find(
        (c) =>
          c.section === target.section &&
          c.group === target.group &&
          c.name === target.name &&
          c.month === 1
      )?.sheetValue ?? 0;

    // Antes de qualquer gasto a celula e um placeholder de texto, por isso o
    // parser nem sequer a regista em parsed.cells (find devolve 0 via `?? 0`).
    expect(find(before)).toBe(0);
    expect(find(after)).toBeCloseTo(5, 2);
  });
});

/**
 * A escrita da ponte do Trading 212 contra a folha verdadeira.
 *
 * Estes casos existem por duas razoes registadas antes de haver codigo: o
 * mecanismo foi construido so para despesas e nunca tinha sido exercido em
 * `savings` nem em `income`, e a ponte escreve nas duas; e as etiquetas N()
 * eram uma aposta sobre o que o parser aceita a ler de volta.
 */
describe("applyExpenses, o que a ponte escreve", () => {
  async function categoryIn(section: "income" | "savings") {
    const parsed = await parseBudgetWorkbook(Buffer.from(bytes()), 2026);
    const c = parsed.categories.find((x) => x.section === section);
    if (!c) throw new Error(`a fixture nao tem nenhuma categoria de ${section}`);
    return c;
  }

  it("escreve numa categoria de savings, que so a ponte usa", async () => {
    const target = await categoryIn("savings");
    const after = await applyExpenses(bytes(), [
      { ...target, month: 9, amount: 500, note: "Trading 212 2026-09-03" },
    ]);

    const parsed = await parseBudgetWorkbook(Buffer.from(after), 2026);
    const row = parsed.categories.find(
      (c) => c.section === "savings" && c.group === target.group && c.name === target.name
    );
    expect(row).toBeTruthy();
  });

  it("escreve numa categoria de income, que so a ponte usa", async () => {
    const target = await categoryIn("income");
    const after = await applyExpenses(bytes(), [
      { ...target, month: 9, amount: 1.31, note: "AAPL_US_EQ 2026-09-15" },
    ]);

    const parsed = await parseBudgetWorkbook(Buffer.from(after), 2026);
    expect(parsed.categories.some((c) => c.section === "income")).toBe(true);
  });

  it("a etiqueta fica na formula da celula", async () => {
    const target = await categoryIn("income");
    const after = unzipSync(
      await applyExpenses(bytes(), [
        { ...target, month: 9, amount: 1.31, note: "AAPL_US_EQ 2026-09-15" },
      ])
    );

    const sheet = Buffer.from(after["xl/worksheets/sheet1.xml"]).toString("utf8");
    expect(sheet).toContain('N("AAPL_US_EQ 2026-09-15")');
  });

  it("a etiqueta nao mexe no valor que o parser le de volta", async () => {
    // O N() de texto vale zero. Se o parser lesse outra coisa, a importacao
    // seguinte reprovava nos totais e revertia -- e a folha do utilizador
    // ficava com etiquetas que nunca mais conseguia importar.
    const target = await categoryIn("income");

    const semNota = await parseBudgetWorkbook(
      Buffer.from(await applyExpenses(bytes(), [{ ...target, month: 9, amount: 1.31 }])),
      2026
    );
    const comNota = await parseBudgetWorkbook(
      Buffer.from(
        await applyExpenses(bytes(), [
          { ...target, month: 9, amount: 1.31, note: "AAPL_US_EQ 2026-09-15" },
        ])
      ),
      2026
    );

    expect(comNota.checksums).toEqual(semNota.checksums);
  });

  it("uma categoria que a folha nao tem diz qual e, pelo nome", async () => {
    // O caso mais provavel de todos: a folha do utilizador nunca teve
    // investimentos, portanto nao tem a linha "Trading 212". A mensagem tem de
    // dizer que linha criar -- e a unica falha aqui que ele consegue resolver.
    const missing = {
      section: "savings" as const,
      group: "",
      name: "Trading 212",
      month: 9,
      amount: 500,
    };

    await expect(applyExpenses(bytes(), [missing])).rejects.toMatchObject({
      missing: { section: "savings", group: "", name: "Trading 212" },
    });
  });
});
