export type InboxSyncResponse = {
  received: number;
  /** Entradas que ficaram na caixa por nao decifrarem ou nao serem validas. */
  failures: { id: string; reason: string }[];
  catalogPushed: boolean;
};
