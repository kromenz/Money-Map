"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGrid } from "../services/budget.service";
import type { GridRow } from "../types/budget";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const SECTION_LABEL: Record<string, string> = {
  income: "Income",
  savings: "Savings",
  expenses: "Expenses",
};

// Locale fixo (nao o do browser) para o servidor e o cliente formatarem igual.
const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

function money(value: string) {
  const n = Number(value);
  if (n === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={n < 0 ? "text-destructive" : undefined}>{eur.format(n)}</span>
  );
}

function groupRows(rows: GridRow[]) {
  const out: { group: string; rows: GridRow[] }[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.group === row.group) last.rows.push(row);
    else out.push({ group: row.group, rows: [row] });
  }
  return out;
}

export function BudgetGrid({ year }: { year: number }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["budget-grid", year],
    queryFn: () => fetchGrid(year),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError)
    return (
      <p className="text-destructive">
        Could not load the grid: {(error as Error).message}
      </p>
    );
  if (!data) return null;

  const sections = ["income", "savings", "expenses"] as const;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium">
              Category
            </th>
            {MONTHS.map((m) => (
              <th key={m} className="px-3 py-2 text-right font-medium">
                {m}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">Year</th>
          </tr>
        </thead>
        {/*
          Uma <tbody> por seccao. Varias <tbody> na mesma <table> sao validas;
          <tbody> aninhada dentro de <tbody> nao e -- os grupos usam Fragment.
        */}
        {sections.map((section) => {
          const rows = data.rows.filter((r) => r.section === section);
          if (rows.length === 0) return null;
          const total = data.sectionTotals.find((t) => t.section === section);

          return (
            <tbody key={section}>
              <tr className="border-t bg-primary/5">
                <td className="px-3 py-2 font-semibold" colSpan={14}>
                  {SECTION_LABEL[section]}
                </td>
              </tr>

              {groupRows(rows).map(({ group, rows: groupedRows }) => (
                <Fragment key={`${section}-${group}`}>
                  {group !== "" && (
                    <tr>
                      <td
                        className="px-3 py-1.5 text-xs uppercase tracking-wide text-muted-foreground"
                        colSpan={14}>
                        {group}
                      </td>
                    </tr>
                  )}
                  {groupedRows.map((row) => (
                    <tr key={row.categoryId} className="border-t">
                      <td className="sticky left-0 z-10 bg-background px-3 py-1.5">
                        {row.name}
                      </td>
                      {row.months.map((v, i) => (
                        <td key={i} className="px-3 py-1.5 text-right tabular-nums">
                          {money(v)}
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                        {money(row.total)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {total && (
                <tr className="border-t-2 font-semibold">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    Total {SECTION_LABEL[section]}
                  </td>
                  {total.months.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">
                      {money(v)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {money(total.total)}
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
