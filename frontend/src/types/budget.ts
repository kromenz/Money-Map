export type GridRow = {
  categoryId: string;
  section: "income" | "savings" | "expenses";
  group: string;
  name: string;
  months: string[];
  total: string;
};

export type SectionTotal = {
  section: string;
  months: string[];
  total: string;
};

export type GridResponse = {
  year: number;
  rows: GridRow[];
  sectionTotals: SectionTotal[];
};

export type MonthComparison = {
  scope: string;
  month: number;
  sheet: string;
  imported: string;
  ok: boolean;
};

export type ImportResult = {
  year: number;
  categoriesCreated: number;
  transactionsWritten: number;
  comparisons: MonthComparison[];
  structure: {
    sections: number;
    groups: string[];
    categories: number;
    comparisonsMade: number;
    comparisonsSkipped: number;
  };
  allMatch: boolean;
};

export type YearWithData = {
  year: number;
  transactions: number;
};

export type CellChange = {
  scope: string;
  name: string;
  month: number;
  from: string | null;
  to: string | null;
  kind: "changed" | "added" | "removed";
};

export type DiffSummary = {
  changed: number;
  added: number;
  removed: number;
  equal: number;
};

/** O mesmo nome que o backend da a isto, para nao haver dois vocabularios. */
export type PreviewResult = {
  year: number;
  summary: DiffSummary;
  changes: CellChange[];
};
