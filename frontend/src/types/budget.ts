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
