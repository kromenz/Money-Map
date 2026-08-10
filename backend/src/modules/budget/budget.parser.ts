import ExcelJS from "exceljs";

export type Section = "income" | "savings" | "expenses";

export type ParsedCategory = {
  section: Section;
  group: string;
  name: string;
  sortOrder: number;
};

export type ParsedCell = {
  section: Section;
  group: string;
  name: string;
  month: number;
  sheetValue: number;
};

export type MonthlyTotals = {
  /** 12 posicoes, indice 0 = Janeiro. null = formula sem valor em cache. */
  months: (number | null)[];
};

export type SheetChecksums = {
  sections: Record<Section, MonthlyTotals>;
  groups: Record<string, MonthlyTotals>;
};

export type ParsedWorkbook = {
  year: number;
  categories: ParsedCategory[];
  cells: ParsedCell[];
  checksums: SheetChecksums;
};

const LABEL_COL = 2;
const FIRST_MONTH_COL = 3;
const LAST_MONTH_COL = 14;

const SECTION_LABELS: Record<string, Section> = {
  Income: "income",
  Savings: "savings",
  Expenses: "expenses",
};

const SECTION_END_LABEL = "Monthly Totals";

/**
 * As celulas com dados sao quase todas formulas (=42.88+11.39). O exceljs
 * devolve {formula, result} nesses casos, e o numero cru nos outros.
 */
function numericValue(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const result = (v as { result?: unknown }).result;
    if (typeof result === "number") return result;
  }
  return null;
}

function textValue(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object") {
    const rich = (v as { richText?: { text: string }[] }).richText;
    if (Array.isArray(rich)) return rich.map((r) => r.text).join("").trim();
    const result = (v as { result?: unknown }).result;
    if (typeof result === "string") return result.trim();
  }
  return "";
}

/**
 * O ficheiro nao tem o formato esperado. Distinto de um erro interno: a culpa e
 * do ficheiro, portanto a resposta e 400 e nao 500.
 */
export class WorkbookFormatError extends Error {}

function findHeaderRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= ws.rowCount; r += 1) {
    if (textValue(ws.getCell(r, FIRST_MONTH_COL)).toUpperCase() === "JAN") {
      return r;
    }
  }
  throw new WorkbookFormatError(
    "Nao encontrei a linha de cabecalho: nenhuma celula da coluna C diz JAN"
  );
}

export function signedAmount(section: Section, sheetValue: number): number {
  return section === "income" ? sheetValue : -sheetValue;
}

function monthValues(ws: ExcelJS.Worksheet, row: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let c = FIRST_MONTH_COL; c <= LAST_MONTH_COL; c += 1) {
    out.push(numericValue(ws.getCell(row, c)));
  }
  return out;
}

export async function parseBudgetWorkbook(
  buffer: Buffer,
  year: number
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new WorkbookFormatError("O ficheiro nao tem nenhuma folha");

  const headerRow = findHeaderRow(ws);

  const categories: ParsedCategory[] = [];
  const cells: ParsedCell[] = [];
  const emptyMonths = (): MonthlyTotals => ({ months: Array(12).fill(null) });
  const checksums: SheetChecksums = {
    sections: {
      income: emptyMonths(),
      savings: emptyMonths(),
      expenses: emptyMonths(),
    },
    groups: {},
  };

  let section: Section | null = null;
  let group = "";
  let sortOrder = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const label = textValue(ws.getCell(r, LABEL_COL));
    const months = monthValues(ws, r);
    const hasMonths = months.some((v) => v !== null);

    const maybeSection = SECTION_LABELS[label];
    if (maybeSection) {
      section = maybeSection;
      group = "";
      continue;
    }

    if (!section) continue;

    if (label === SECTION_END_LABEL) {
      checksums.sections[section] = { months };
      section = null;
      group = "";
      continue;
    }

    if (label === "") {
      // Subtotal de grupo. Exige meses numericos para que uma linha em branco
      // dentro de um grupo nao seja lida como o subtotal desse grupo.
      if (group !== "" && hasMonths) {
        checksums.groups[`${section}/${group}`] = { months };
      }
      continue;
    }

    // Cabecalho de grupo: tem rotulo mas nenhuma celula de mes.
    //
    // A regra anterior era "o total anual nao e numerico", e estava errada: o
    // Excel omite o valor em cache quando o resultado e zero, portanto toda a
    // categoria a zeros era lida como grupo, desaparecia, e passava a ser o
    // grupo das categorias seguintes. E a presenca das celulas que distingue --
    // um 0 e um valor, ausencia nao e.
    if (!hasMonths) {
      group = label;
      continue;
    }

    sortOrder += 1;
    categories.push({ section, group, name: label, sortOrder });

    // section e group sao `let` do ciclo; fixa-los aqui mantem o tipo estreitado
    // dentro do callback, que de outra forma volta a ver `Section | null`.
    const rowSection = section;
    const rowGroup = group;

    months.forEach((value, i) => {
      if (value === null || value === 0) return;
      cells.push({
        section: rowSection,
        group: rowGroup,
        name: label,
        month: i + 1,
        sheetValue: value,
      });
    });
  }

  return { year, categories, cells, checksums };
}
