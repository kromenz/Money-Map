import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
// O parser real do backend. Importa so o exceljs, nada de Prisma, por isso
// corre aqui sem mais nada. Importa-lo em vez de o copiar e o que garante que a
// fixture e lida exactamente pelas regras que o import usa.
import { parseBudgetWorkbook } from "../../../backend/src/modules/budget/budget.parser";

const FIXTURE = path.resolve(__dirname, "__fixtures__/budget-2026.xlsx");
const fixtureBytes = () => new Uint8Array(readFileSync(FIXTURE));

describe("fixture", () => {
  it("tem as partes que uma regravacao com ExcelJS destruiria", () => {
    const files = unzipSync(fixtureBytes());
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "xl/worksheets/sheet1.xml",
        "xl/charts/chart1.xml",
        "xl/charts/chart2.xml",
        "xl/drawings/drawing1.xml",
      ])
    );
  });

  it("tem as tres seccoes e categorias em todas", async () => {
    const parsed = await parseBudgetWorkbook(
      Buffer.from(fixtureBytes()),
      2026
    );
    const sections = new Set(parsed.categories.map((c) => c.section));
    expect(sections).toEqual(new Set(["income", "savings", "expenses"]));
    expect(parsed.categories.length).toBeGreaterThan(20);
  });

  it("tem a identidade e as datas escrubbed no docProps/core.xml", () => {
    // Assercoes positivas de proposito: o teste que prova o scrub nao pode
    // ele proprio citar o nome real ou a data real, senao o teste commitado
    // seria a fuga que devia prevenir. Descreve-se o que a fixture TEM de
    // ter, nunca o que nao pode ter.
    const files = unzipSync(fixtureBytes());
    const core = new TextDecoder().decode(files["docProps/core.xml"]);

    const creator = core.match(/<dc:creator>([^<]*)<\/dc:creator>/)?.[1];
    const lastModifiedBy = core.match(
      /<cp:lastModifiedBy>([^<]*)<\/cp:lastModifiedBy>/
    )?.[1];
    const lastPrinted = core.match(/<cp:lastPrinted>([^<]*)<\/cp:lastPrinted>/)?.[1];
    const created = core.match(
      /<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/
    )?.[1];
    const modified = core.match(
      /<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/
    )?.[1];

    // Tem de bater com FIXTURE_IDENTITY / FIXTURE_DATE em
    // frontend/scripts/make-fixture.mjs.
    expect(creator).toBe("MoneyMap fixture");
    expect(lastModifiedBy).toBe("MoneyMap fixture");
    expect(lastPrinted).toBe("2020-01-01T00:00:00Z");
    expect(created).toBe("2020-01-01T00:00:00Z");
    expect(modified).toBe("2020-01-01T00:00:00Z");
  });

  it("nao tem o elemento com o caminho local de quem gerou o ficheiro", () => {
    const files = unzipSync(fixtureBytes());
    const workbook = new TextDecoder().decode(files["xl/workbook.xml"]);

    // Assercao negativa, mas sobre um nome de elemento do schema OOXML
    // ("x15ac:absPath"), nao sobre um valor real -- o caminho local em si
    // nunca aparece como literal neste ficheiro.
    expect(workbook).not.toMatch(/<x15ac:absPath\b/);
    // A Task 4 faz asserts sobre isto -- o scrub do absPath nao pode o tocar.
    expect(workbook).toContain("<calcPr");
  });

  it("os subtotais de grupo batem com a soma das suas categorias", async () => {
    const parsed = await parseBudgetWorkbook(
      Buffer.from(fixtureBytes()),
      2026
    );

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

        // A mesma tolerancia do matches() do backend.
        expect(Math.abs(sum - sheet)).toBeLessThanOrEqual(0.005);
      }
    }
  });
});
