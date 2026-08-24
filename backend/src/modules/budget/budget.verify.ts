import { Prisma } from "@prisma/client";

export type MonthComparison = {
  /** `income` / `expenses/Home` -- o mesmo formato de chave dos checksums. */
  scope: string;
  /** 1 = Janeiro. */
  month: number;
  sheet: string;
  imported: string;
  ok: boolean;
};

export type StructureReport = {
  sections: number;
  /** Lista plana de chaves `${section}/${group}`. */
  groups: string[];
  categories: number;
  /** Contadores de celulas (escopo x mes), nao de escopos. */
  comparisonsMade: number;
  comparisonsSkipped: number;
};

/** Compara ao centimo. Decimal evita o erro de virgula flutuante. */
export function matches(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.minus(b).abs().lessThanOrEqualTo(new Prisma.Decimal("0.005"));
}

/**
 * Compara os 12 meses de um escopo.
 *
 * Os meses em que a folha nao tem valor em cache sao saltados, nao comparados
 * contra zero: assumir zero seria inventar um facto, e e exactamente a familia
 * de erro que este modulo existe para apanhar. Quem chama tem de olhar para o
 * `skipped` -- "0 de 0 comparacoes bateram" nao e sucesso.
 */
export function compareScope(
  scope: string,
  sheetMonths: (number | null)[],
  importedMonths: Prisma.Decimal[]
): { rows: MonthComparison[]; made: number; skipped: number } {
  const rows: MonthComparison[] = [];
  let made = 0;
  let skipped = 0;

  for (let i = 0; i < 12; i += 1) {
    const declared = sheetMonths[i];
    if (declared === null || declared === undefined) {
      skipped += 1;
      continue;
    }

    const sheet = new Prisma.Decimal(declared.toFixed(2));
    const imported = importedMonths[i] ?? new Prisma.Decimal(0);
    made += 1;
    rows.push({
      scope,
      month: i + 1,
      sheet: sheet.toFixed(2),
      imported: imported.toFixed(2),
      ok: matches(sheet, imported),
    });
  }

  return { rows, made, skipped };
}
