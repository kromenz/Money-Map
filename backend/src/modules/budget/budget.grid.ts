import { Prisma, Section } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { monthDate } from "./budget.service";

export type GridRow = {
  categoryId: string;
  section: string;
  group: string;
  name: string;
  months: string[];
  total: string;
};

export type GridResponse = {
  year: number;
  rows: GridRow[];
  sectionTotals: { section: string; months: string[]; total: string }[];
};

/** Desfaz a inversao de sinal, devolvendo a convencao da folha. */
export function toDisplay(
  section: string,
  amount: Prisma.Decimal
): Prisma.Decimal {
  return section === "income" ? amount : amount.negated();
}

export async function buildGrid(
  userId: string,
  year: number
): Promise<GridResponse> {
  const categories = await prisma.category.findMany({
    where: { userId, archived: false },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }],
  });

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      categoryId: { not: null },
      date: { gte: monthDate(year, 1), lt: monthDate(year + 1, 1) },
    },
    select: { categoryId: true, date: true, amount: true },
  });

  // categoryId -> 12 acumuladores
  const buckets = new Map<string, Prisma.Decimal[]>();
  for (const c of categories) {
    buckets.set(
      c.id,
      Array.from({ length: 12 }, () => new Prisma.Decimal(0))
    );
  }

  for (const t of transactions) {
    const row = buckets.get(t.categoryId as string);
    if (!row) continue;
    const monthIndex = t.date.getUTCMonth();
    row[monthIndex] = row[monthIndex].plus(t.amount);
  }

  const rows: GridRow[] = [];
  const sectionAcc = new Map<string, Prisma.Decimal[]>();

  for (const c of categories) {
    const raw = buckets.get(c.id) as Prisma.Decimal[];
    const display = raw.map((v) => toDisplay(c.section, v));

    rows.push({
      categoryId: c.id,
      section: c.section,
      group: c.group,
      name: c.name,
      months: display.map((v) => v.toFixed(2)),
      total: display
        .reduce((a, b) => a.plus(b), new Prisma.Decimal(0))
        .toFixed(2),
    });

    if (!sectionAcc.has(c.section)) {
      sectionAcc.set(
        c.section,
        Array.from({ length: 12 }, () => new Prisma.Decimal(0))
      );
    }
    const acc = sectionAcc.get(c.section) as Prisma.Decimal[];
    display.forEach((v, i) => {
      acc[i] = acc[i].plus(v);
    });
  }

  const sectionTotals = (["income", "savings", "expenses"] as const)
    .filter((s) => sectionAcc.has(s))
    .map((s) => {
      const acc = sectionAcc.get(s) as Prisma.Decimal[];
      return {
        section: s as string,
        months: acc.map((v) => v.toFixed(2)),
        total: acc.reduce((a, b) => a.plus(b), new Prisma.Decimal(0)).toFixed(2),
      };
    });

  return { year, rows, sectionTotals };
}
