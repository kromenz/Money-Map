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

export type SheetChecksums = {
  sections: Record<Section, number>;
  groups: Record<string, number>;
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
const ANNUAL_COL = 15;

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

function findHeaderRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= ws.rowCount; r += 1) {
    if (textValue(ws.getCell(r, FIRST_MONTH_COL)).toUpperCase() === "JAN") {
      return r;
    }
  }
  throw new Error(
    "Nao encontrei a linha de cabecalho: nenhuma celula da coluna C diz JAN"
  );
}

export function signedAmount(section: Section, sheetValue: number): number {
  return section === "income" ? sheetValue : -sheetValue;
}

export async function parseBudgetWorkbook(
  buffer: Buffer,
  year: number
): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("O ficheiro nao tem nenhuma folha");

  const headerRow = findHeaderRow(ws);

  const categories: ParsedCategory[] = [];
  const cells: ParsedCell[] = [];
  const checksums: SheetChecksums = {
    sections: { income: 0, savings: 0, expenses: 0 },
    groups: {},
  };

  let section: Section | null = null;
  let group = "";
  let sortOrder = 0;

  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const label = textValue(ws.getCell(r, LABEL_COL));
    const annual = numericValue(ws.getCell(r, ANNUAL_COL));

    // Inicio de seccao
    const maybeSection = SECTION_LABELS[label];
    if (maybeSection) {
      section = maybeSection;
      group = "";
      continue;
    }

    if (!section) continue;

    // Fim de seccao: guarda o total que a folha declara e fecha
    if (label === SECTION_END_LABEL) {
      checksums.sections[section] = annual ?? 0;
      section = null;
      group = "";
      continue;
    }

    // Subtotal de grupo: rotulo vazio
    if (label === "") {
      if (group !== "" && annual !== null) {
        checksums.groups[`${section}/${group}`] = annual;
      }
      continue;
    }

    // Cabecalho de grupo: tem rotulo mas o total anual nao e numerico.
    // Esta e a regra critica -- ver a tabela na descricao da task.
    if (annual === null) {
      group = label;
      continue;
    }

    // Categoria
    sortOrder += 1;
    categories.push({ section, group, name: label, sortOrder });

    for (let c = FIRST_MONTH_COL; c <= LAST_MONTH_COL; c += 1) {
      const value = numericValue(ws.getCell(r, c));
      if (value === null || value === 0) continue;
      cells.push({
        section,
        group,
        name: label,
        month: c - FIRST_MONTH_COL + 1,
        sheetValue: value,
      });
    }
  }

  return { year, categories, cells, checksums };
}
