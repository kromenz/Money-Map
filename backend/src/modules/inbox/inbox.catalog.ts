import { prisma } from "../../db/prisma";
import { getNoteSuggestions, type NoteSuggestion } from "../budget/budget.notes.query";

export type CatalogCategory = { section: string; group: string; name: string; sortOrder: number };

export type Catalog = {
  categories: CatalogCategory[];
  notes: NoteSuggestion[];
  builtAt: string;
};

/**
 * O que o telemovel precisa para registar sem rede: as categorias que a folha
 * tem e as notas mais usadas. Os mesmos dados que a barra do dashboard usa
 * (buildGrid e getNoteSuggestions), para os dois lados oferecerem o mesmo.
 */
export async function buildCatalog(
  userId: string,
  now: () => Date = () => new Date()
): Promise<Catalog> {
  const [categories, notes] = await Promise.all([
    prisma.category.findMany({
      where: { userId, archived: false },
      select: { section: true, group: true, name: true, sortOrder: true },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
    }),
    getNoteSuggestions(userId),
  ]);

  return { categories, notes, builtAt: now().toISOString() };
}
