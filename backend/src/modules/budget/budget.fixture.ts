import ExcelJS from "exceljs";

type Row =
  | { kind: "sectionStart"; label: string }
  | { kind: "groupHeader"; label: string }
  | { kind: "subtotal"; months: (number | null)[] }
  | { kind: "sectionTotal"; months: (number | null)[] }
  | {
      kind: "category";
      label: string;
      months: (number | { formula: string; result: number } | null)[];
    }
  | { kind: "blank" };

function sum(values: (number | { result: number } | null)[]): number {
  return values.reduce<number>((acc, v) => {
    if (v === null) return acc;
    return acc + (typeof v === "number" ? v : v.result);
  }, 0);
}

/**
 * Reproduz o layout do template "Personal Budget" da Microsoft:
 * linha de cabecalho com JAN..DEZ nas colunas 3..14, total anual na 15.
 */
export async function buildFixtureWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Personal Budget");

  const rows: Row[] = [
    { kind: "blank" },
    { kind: "blank" },

    { kind: "sectionStart", label: "Income" },
    { kind: "blank" },
    // JAN=1150, FEV com acerto escrito como formula
    {
      kind: "category",
      label: "Salario",
      months: [1150, { formula: "1150-1052.15+261.36", result: 359.21 }],
    },
    // negativo dentro do Income: desconto, nao despesa
    { kind: "category", label: "IRS", months: [-100, -100] },
    // categoria sem dados nenhuns: doze meses vazios, total anual a zero
    { kind: "category", label: "Real Vida", months: [] },
    { kind: "category", label: "Other", months: [54.7, null] },
    { kind: "sectionTotal", months: [1104.7, 259.21] },

    { kind: "blank" },
    { kind: "sectionStart", label: "Savings" },
    { kind: "blank" },
    { kind: "category", label: "Savings and Investments", months: [0, 200] },
    { kind: "category", label: "Other", months: [] },
    { kind: "sectionTotal", months: [0, 200] },

    { kind: "blank" },
    { kind: "sectionStart", label: "Expenses" },
    { kind: "groupHeader", label: "Home" },
    { kind: "category", label: "Mortgage / Rent", months: [] },
    { kind: "subtotal", months: [0, 0] },
    { kind: "groupHeader", label: "Personal and Family" },
    {
      kind: "category",
      label: "Tecnology",
      months: [{ formula: "42.88+11.39+54.97", result: 109.24 }, 20],
    },
    // reembolso netado: compra menos devolucao
    {
      kind: "category",
      label: "Temu",
      months: [{ formula: "27.16-14.99", result: 12.17 }, null],
    },
    { kind: "category", label: "Other", months: [8.37, 0] },
    { kind: "subtotal", months: [129.78, 20] },
    { kind: "sectionTotal", months: [129.78, 20] },
  ];

  // Linha 1: cabecalho dos meses.
  const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
                  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  MONTHS.forEach((m, i) => {
    ws.getCell(1, 3 + i).value = m;
  });

  let r = 2;
  for (const row of rows) {
    switch (row.kind) {
      case "blank":
        break;
      case "sectionStart":
        ws.getCell(r, 2).value = row.label;
        break;
      case "groupHeader":
        ws.getCell(r, 2).value = row.label;
        // coluna 15 nao numerica -- e isto que o distingue de uma categoria
        ws.getCell(r, 15).value = "Annually";
        break;
      case "subtotal":
      case "sectionTotal": {
        if (row.kind === "sectionTotal") ws.getCell(r, 2).value = "Monthly Totals";
        row.months.forEach((v, i) => {
          if (v !== null) ws.getCell(r, 3 + i).value = v;
        });
        ws.getCell(r, 15).value = sum(row.months);
        break;
      }
      case "category": {
        ws.getCell(r, 2).value = row.label;
        row.months.forEach((v, i) => {
          if (v === null) return;
          ws.getCell(r, 3 + i).value =
            typeof v === "number" ? v : { formula: v.formula, result: v.result };
        });
        ws.getCell(r, 15).value = sum(row.months);
        break;
      }
    }
    r += 1;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
