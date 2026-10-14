export type StoredEntry = { id: string; blob: string };

/**
 * O que o handler precisa da base. Uma interface para o handler se testar em
 * Node, sem D1; o d1-store.ts e a versao real.
 */
export interface Store {
  /** Nao substitui: o primeiro blob de um id e o que fica. */
  addEntry(id: string, blob: string, createdAt: string): Promise<void>;
  listEntries(limit: number): Promise<StoredEntry[]>;
  presentIds(ids: string[]): Promise<string[]>;
  deleteEntry(id: string): Promise<void>;
  getCatalog(): Promise<string | null>;
  putCatalog(blob: string, updatedAt: string): Promise<void>;
  hasDevice(tokenHash: string): Promise<boolean>;
  addDevice(tokenHash: string, label: string, createdAt: string): Promise<void>;
  deleteDevice(tokenHash: string): Promise<void>;
}

export function memoryStore(): Store {
  const entries = new Map<string, { blob: string; createdAt: string }>();
  const devices = new Set<string>();
  let catalog: string | null = null;

  return {
    async addEntry(id, blob, createdAt) {
      if (!entries.has(id)) entries.set(id, { blob, createdAt });
    },
    async listEntries(limit) {
      return [...entries]
        .sort(([ia, a], [ib, b]) => a.createdAt.localeCompare(b.createdAt) || ia.localeCompare(ib))
        .slice(0, limit)
        .map(([id, e]) => ({ id, blob: e.blob }));
    },
    async presentIds(ids) {
      return ids.filter((id) => entries.has(id));
    },
    async deleteEntry(id) {
      entries.delete(id);
    },
    async getCatalog() {
      return catalog;
    },
    async putCatalog(blob) {
      catalog = blob;
    },
    async hasDevice(h) {
      return devices.has(h);
    },
    async addDevice(h) {
      devices.add(h);
    },
    async deleteDevice(h) {
      devices.delete(h);
    },
  };
}
