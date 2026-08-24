import ExcelJS from "exceljs";

type Row =
  | { kind: "sectionStart"; label: string }
  | { kind: "groupHeader"; label: string; annuallyLabel?: boolean }
  | { kind: "subtotal"; months: (number | null)[] }
  | { kind: "sectionTotal"; months: (number | null)[] }
  | {
      kind: "category";
      label: string;
      months: (number | { formula: string; result: number } | null)[];
      /** Cache do anual em desacordo com os meses, como acontece no ficheiro real. */
      staleAnnual?: number | null;
    }
  | { kind: "blank" };

function sum(values: (number | { result: number } | null)[]): number {
  return values.reduce<number>((acc, v) => {
    if (v === null) return acc;
    return acc + (typeof v === "number" ? v : v.result);
  }, 0);
}

/**
 * O Excel omite o valor em cache das celulas de formula quando o resultado e
 * zero, e usa formulas partilhadas que nao guardam resultado proprio. Uma
 * fixture que escreve numeros literais nunca produz esse estado -- foi por isso
 * que o bug das categorias a zeros sobreviveu aos testes.
 *
 * cached === null  -> celula de formula sem <v>, como o Excel faz quando da 0
 * cached === numero -> celula de formula com valor em cache
 */
function formulaCell(cached: number | null) {
  return cached === null
    ? { formula: "SUM(C1:N1)" }
    : { formula: "SUM(C1:N1)", result: cached };
}

/** Doze meses. As posicoes nao preenchidas ficam a zero, como no template. */
function twelveMonths(
  values: (number | { formula: string; result: number } | null)[]
): (number | { formula: string; result: number })[] {
  const out: (number | { formula: string; result: number })[] = [];
  for (let i = 0; i < 12; i += 1) {
    const v = values[i];
    out.push(v === null || v === undefined ? 0 : v);
  }
  return out;
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
    {
      kind: "category",
      label: "Salario",
      months: [1150, { formula: "1150-1052.15+261.36", result: 359.21 }],
    },
    // negativo dentro do Income: desconto, nao despesa
    { kind: "category", label: "IRS", months: [-100, -100] },
    // categoria sem dados nenhuns: doze zeros e anual sem cache. E este o caso
    // que o parser antigo lia como cabecalho de grupo.
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

    // Primeiro grupo: leva o rotulo "Annually" na coluna 15, como no real.
    { kind: "groupHeader", label: "Home", annuallyLabel: true },
    { kind: "category", label: "Mortgage / Rent", months: [] },
    { kind: "subtotal", months: [0, 0] },

    // Segundo grupo: SEM "Annually". Se a classificacao depender desse texto,
    // este grupo parte.
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
    // cache do anual em desacordo com os meses (soma 8.37, cache diz 999)
    { kind: "category", label: "Gym", months: [8.37, 0], staleAnnual: 999 },
    { kind: "subtotal", months: [129.78, 20] },
    // linha em branco DENTRO do grupo, DEPOIS do subtotal: se o guard
    // hasMonths faltar, esta linha reescreve o checksum ja gravado com nulls.
    { kind: "blank" },

    // Grupo chamado "Other", logo a seguir a categorias chamadas "Other".
    { kind: "groupHeader", label: "Other" },
    { kind: "category", label: "Miscellaneous Expenses", months: [5, 0] },
    { kind: "category", label: "Other", months: [] },
    { kind: "subtotal", months: [5, 0] },

    { kind: "sectionTotal", months: [134.78, 20] },
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
        // Cabecalho de grupo: rotulo e NENHUMA celula de mes. E a ausencia de
        // meses que o distingue de uma categoria, nao o texto "Annually" --
        // no ficheiro real so o primeiro grupo de cada seccao o tem.
        ws.getCell(r, 2).value = row.label;
        if (row.annuallyLabel) ws.getCell(r, 15).value = "Annually";
        break;
      case "subtotal":
      case "sectionTotal": {
        if (row.kind === "sectionTotal") ws.getCell(r, 2).value = "Monthly Totals";
        // Os subtotais no ficheiro real sao formulas partilhadas, e quando dao
        // zero o Excel nao guarda valor em cache (linha 51 do 2026.xlsx). E
        // este o caso que deixa um escopo por comparar, em vez de o comparar
        // contra um zero inventado.
        for (let i = 0; i < 12; i += 1) {
          const v = row.months[i] ?? 0;
          ws.getCell(r, 3 + i).value = formulaCell(v || null) as ExcelJS.CellValue;
        }
        ws.getCell(r, 15).value = formulaCell(sum(row.months) || null) as ExcelJS.CellValue;
        break;
      }
      case "category": {
        ws.getCell(r, 2).value = row.label;
        twelveMonths(row.months).forEach((v, i) => {
          ws.getCell(r, 3 + i).value = v as ExcelJS.CellValue;
        });
        // O anual e informativo. staleAnnual permite reproduzir a cache
        // obsoleta que existe no ficheiro real (linha 82 do 2026.xlsx).
        const cached =
          row.staleAnnual !== undefined ? row.staleAnnual : sum(row.months) || null;
        ws.getCell(r, 15).value = formulaCell(cached) as ExcelJS.CellValue;
        break;
      }
    }
    r += 1;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
