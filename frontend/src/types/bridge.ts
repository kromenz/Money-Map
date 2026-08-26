import type { Section } from "./expense";

/**
 * Uma parcela da ponte do Trading 212 que ainda nao esta na folha.
 *
 * O `delta` ja vem na convencao da folha -- e o numero a somar a celula, com o
 * sinal que o utilizador ve. O `amount` e o total da linha na convencao de
 * armazenamento, e volta ao servidor tal e qual depois de a folha aceitar.
 */
export type SheetEdit = {
  externalId: string;
  year: number;
  month: number;
  section: Section;
  group: string;
  name: string;
  delta: string;
  note: string;
  amount: string;
};

export type BridgeFlushResponse = {
  /** Parcelas que ficaram escritas na folha e marcadas no servidor. */
  written: number;
  /** Parcelas que ficaram por escrever; a proxima tentativa repete-as. */
  skipped: number;
  failures: { year: number; reason: string }[];
};
