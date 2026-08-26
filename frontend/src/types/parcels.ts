export type ParcelView = {
  seq: number;
  /** Decimal em string, na convencao da folha -- como tudo o que vem do backend. */
  amount: string;
  /** null nas parcelas que ja estavam na folha antes de haver etiquetas. */
  note: string | null;
};

export type CategoryParcels = {
  categoryId: string;
  section: string;
  group: string;
  name: string;
  total: string;
  parcels: ParcelView[];
};

export type MonthParcels = {
  year: number;
  month: number;
  categories: CategoryParcels[];
};
