import type { Store } from "./store";

export function d1Store(db: D1Database): Store {
  return {
    async addEntry(id, blob, createdAt) {
      await db
        .prepare("INSERT OR IGNORE INTO entries (id, blob, created_at) VALUES (?, ?, ?)")
        .bind(id, blob, createdAt)
        .run();
    },
    async listEntries(limit) {
      const { results } = await db
        .prepare("SELECT id, blob FROM entries ORDER BY created_at, id LIMIT ?")
        .bind(limit)
        .all<{ id: string; blob: string }>();
      return results;
    },
    async presentIds(ids) {
      if (ids.length === 0) return [];
      const marks = ids.map(() => "?").join(",");
      const { results } = await db
        .prepare(`SELECT id FROM entries WHERE id IN (${marks})`)
        .bind(...ids)
        .all<{ id: string }>();
      return results.map((r) => r.id);
    },
    async deleteEntry(id) {
      await db.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
    },
    async getCatalog() {
      const row = await db
        .prepare("SELECT blob FROM catalog WHERE id = 1")
        .first<{ blob: string }>();
      return row?.blob ?? null;
    },
    async putCatalog(blob, updatedAt) {
      await db
        .prepare(
          "INSERT INTO catalog (id, blob, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET blob = excluded.blob, updated_at = excluded.updated_at"
        )
        .bind(blob, updatedAt)
        .run();
    },
    async hasDevice(tokenHash) {
      const row = await db
        .prepare("SELECT 1 AS found FROM devices WHERE token_hash = ?")
        .bind(tokenHash)
        .first();
      return row !== null;
    },
    async addDevice(tokenHash, label, createdAt) {
      await db
        .prepare("INSERT OR REPLACE INTO devices (token_hash, label, created_at) VALUES (?, ?, ?)")
        .bind(tokenHash, label, createdAt)
        .run();
    },
    async deleteDevice(tokenHash) {
      await db.prepare("DELETE FROM devices WHERE token_hash = ?").bind(tokenHash).run();
    },
  };
}
