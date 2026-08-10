import { Prisma } from "@prisma/client";
import { matches } from "./budget.verify";

/** Uma celula (categoria x mes) na convencao da folha: despesa positiva. */
export type DiffCell = {
  section: string;
  group: string;
  name: string;
  /** 1 = Janeiro. */
  month: number;
  value: Prisma.Decimal;
};

export type DiffKind = "changed" | "added" | "removed";

export type CellChange = {
  /** `income` / `expenses/Home` -- o mesmo formato de escopo do resto do modulo. */
  scope: string;
  name: string;
  month: number;
  /** null quando a celula nao existia antes. */
  from: string | null;
  /** null quando a celula deixa de existir. */
  to: string | null;
  kind: DiffKind;
};

export type DiffSummary = {
  changed: number;
  added: number;
  removed: number;
  equal: number;
};

export type WorkbookDiff = {
  summary: DiffSummary;
  changes: CellChange[];
};

/**
 * A chave tem de incluir o grupo: ha varias categorias chamadas "Other" em
 * grupos diferentes, e sem o grupo uma engolia a outra.
 */
function keyOf(c: DiffCell): string {
  return `${c.section}/${c.group}/${c.name}#${c.month}`;
}

function scopeOf(c: DiffCell): string {
  return `${c.section}/${c.group}`;
}

/**
 * Compara as celulas da folha com as que estao gravadas.
 *
 * Nenhum dos lados traz zeros: o parser nao gera celulas a zero e o import so
 * grava as que gera. Uma celula que exista de um lado so e, portanto, uma
 * diferenca real e nao um zero implicito.
 */
export function diffCells(
  sheet: DiffCell[],
  stored: DiffCell[]
): WorkbookDiff {
  const storedByKey = new Map<string, DiffCell>();
  for (const c of stored) storedByKey.set(keyOf(c), c);

  const changes: CellChange[] = [];
  const summary: DiffSummary = { changed: 0, added: 0, removed: 0, equal: 0 };
  const seen = new Set<string>();

  for (const c of sheet) {
    const key = keyOf(c);
    seen.add(key);
    const before = storedByKey.get(key);

    if (!before) {
      summary.added += 1;
      changes.push({
        scope: scopeOf(c),
        name: c.name,
        month: c.month,
        from: null,
        to: c.value.toFixed(2),
        kind: "added",
      });
      continue;
    }

    if (matches(c.value, before.value)) {
      summary.equal += 1;
      continue;
    }

    summary.changed += 1;
    changes.push({
      scope: scopeOf(c),
      name: c.name,
      month: c.month,
      from: before.value.toFixed(2),
      to: c.value.toFixed(2),
      kind: "changed",
    });
  }

  for (const c of stored) {
    if (seen.has(keyOf(c))) continue;
    summary.removed += 1;
    changes.push({
      scope: scopeOf(c),
      name: c.name,
      month: c.month,
      from: c.value.toFixed(2),
      to: null,
      kind: "removed",
    });
  }

  // Ordem estavel para a lista nao saltar entre pedidos iguais.
  changes.sort(
    (a, b) =>
      a.scope.localeCompare(b.scope) ||
      a.name.localeCompare(b.name) ||
      a.month - b.month
  );

  return { summary, changes };
}
