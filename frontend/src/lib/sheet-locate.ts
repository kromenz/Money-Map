import ExcelJS from "exceljs";
import type { Section, SheetTarget } from "@/types/expense";

/**
 * O alvo nao existe na folha. Distinto de um erro interno: a culpa e do pedido,
 * e a resposta ao browser e 400 e nao 500.
 */
export class SheetTargetError extends Error {}

export type CellTargets = {
  /** Ex.: "H26". */
  cell: string;
  /**
   * Subtotal do grupo, ou null quando a categoria nao esta dentro de nenhum
   * grupo, ou quando a folha nao tem essa linha. O parser so recolhe checksums
   * de grupo quando o grupo tem nome, por isso null aqui significa "nao ha nada
   * a verificar", nao "nao encontrei".
   */
  groupSubtotal: string | null;
  /** Linha `Monthly Totals` da seccao, ou null se a folha nao a tiver. */
  sectionTotal: string | null;
};

// As mesmas colunas de budget.parser.ts. B = rotulo, C..N = meses.
const LABEL_COL = 2;
const FIRST_MONTH_COL = 3;
const LAST_MONTH_COL = 14;

const SECTION_LABELS: Record<string, Section> = {
  Income: "income",
  Savings: "savings",
  Expenses: "expenses",
};

const SECTION_END_LABEL = "Monthly Totals";

/** A coluna do mes. Janeiro = C. */
export function columnLetter(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new SheetTargetError(`Mes fora da gama: ${month}`);
  }
  return String.fromCharCode("A".charCodeAt(0) + FIRST_MONTH_COL - 1 + month - 1);
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

function numericValue(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const result = (v as { result?: unknown }).result;
    if (typeof result === "number") return result;
  }
  // For formula cells, ExcelJS stores the result in cell.result
  if (typeof cell.result === "number") return cell.result;
  return null;
}

function hasMonths(ws: ExcelJS.Worksheet, row: number): boolean {
  for (let c = FIRST_MONTH_COL; c <= LAST_MONTH_COL; c += 1) {
    if (numericValue(ws.getCell(row, c)) !== null) return true;
  }
  return false;
}

/**
 * Onde escrever, e que subtotais e que passam a estar errados por causa disso.
 *
 * A sequencia de decisoes por linha e a mesma de parseBudgetWorkbook. Nao e
 * codigo partilhado -- os dois pacotes nao partilham nada -- mas e a mesma
 * ordem, deliberadamente, para se comparar a olho. A divergencia entre os dois
 * e apanhada pela verificacao do import, que reverte se os totais nao baterem.
 */
export async function locateCells(
  file: Uint8Array,
  target: SheetTarget
): Promise<CellTargets> {
  const column = columnLetter(target.month);

  const wb = new ExcelJS.Workbook();
  // Buffer.from copia. Passar `file.buffer` directamente lia o ArrayBuffer
  // inteiro por baixo do Uint8Array, que pode ser maior do que a vista quando
  // vem de um readFile.
  await wb.xlsx.load(Buffer.from(file) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new SheetTargetError("O ficheiro nao tem nenhuma folha");

  let headerRow = 0;
  for (let r = 1; r <= ws.rowCount; r += 1) {
    if (textValue(ws.getCell(r, FIRST_MONTH_COL)).toUpperCase() === "JAN") {
      headerRow = r;
      break;
    }
  }
  if (headerRow === 0) {
    throw new SheetTargetError("Nao encontrei a linha de cabecalho");
  }

  let section: Section | null = null;
  let group = "";

  let cellRow: number | null = null;
  let groupRow: number | null = null;
  let sectionRow: number | null = null;

  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const label = textValue(ws.getCell(r, LABEL_COL));

    const maybeSection = SECTION_LABELS[label];
    if (maybeSection) {
      section = maybeSection;
      group = "";
      continue;
    }

    if (!section) continue;

    if (label === SECTION_END_LABEL) {
      if (section === target.section) sectionRow = r;
      section = null;
      group = "";
      continue;
    }

    const months = hasMonths(ws, r);

    if (label === "") {
      // Subtotal de grupo. Exige meses numericos para que uma linha em branco
      // dentro de um grupo nao seja lida como o subtotal desse grupo.
      if (group !== "" && months) {
        if (section === target.section && group === target.group) groupRow = r;
      }
      continue;
    }

    // Cabecalho de grupo: tem rotulo mas nenhuma celula de mes.
    if (!months) {
      group = label;
      continue;
    }

    if (
      section === target.section &&
      group === target.group &&
      label === target.name
    ) {
      cellRow = r;
    }
  }

  if (cellRow === null) {
    throw new SheetTargetError(
      `A folha nao tem ${target.section}/${target.group}/${target.name}`
    );
  }

  return {
    cell: `${column}${cellRow}`,
    groupSubtotal: groupRow === null ? null : `${column}${groupRow}`,
    sectionTotal: sectionRow === null ? null : `${column}${sectionRow}`,
  };
}
