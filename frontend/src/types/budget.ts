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

export type ChecksumReport = {
  scope: string;
  sheet: string;
  imported: string;
  ok: boolean;
};

export type ImportResult = {
  year: number;
  categoriesCreated: number;
  transactionsWritten: number;
  checksums: ChecksumReport[];
  allMatch: boolean;
};
