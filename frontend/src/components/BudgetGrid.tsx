"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGrid } from "../services/budget.service";
import { Skeleton } from "@/components/ui/skeleton";
import { MONTH_LABELS, formatEur } from "@/lib/format";
import { groupRows } from "@/lib/group-rows";

const SECTION_LABEL: Record<string, string> = {
  income: "Income",
  savings: "Savings",
  expenses: "Expenses",
};

function money(value: string) {
  const n = Number(value);
  if (n === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={n < 0 ? "text-destructive" : undefined}>{formatEur(n)}</span>
  );
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
    // O overflow-x fica como rede de seguranca para ecras estreitos, mas com
    // px-2 as 14 colunas ja cabem sem scroll na largura da pagina.
    //
    // A max-h nao e cosmetica: overflow-x-auto faz o browser calcular
    // overflow-y: auto tambem, logo esta div e um scroll container. Sem altura
    // limitada nunca ha scroll vertical dentro dela e o sticky do cabecalho
    // fica inerte -- colava-se ao topo da div, que desaparece com a pagina.
    <div className="max-h-[70vh] overflow-auto rounded-lg border">
      <table className="w-full border-collapse text-sm">
        <thead>
          {/*
            Cabecalho colado ao topo: com dezenas de categorias perde-se de vista
            que coluna e que mes. O canto acumula sticky no topo e a esquerda, por
            isso precisa de z maior que as duas faixas que atravessa.
          */}
          <tr className="bg-muted/50">
            <th className="sticky left-0 top-0 z-30 bg-muted/50 px-2 py-2 text-left font-medium">
              Category
            </th>
            {MONTH_LABELS.map((m) => (
              <th
                key={m}
                className="sticky top-0 z-20 bg-muted/50 px-2 py-2 text-right font-medium">
                {m}
              </th>
            ))}
            <th className="sticky top-0 z-20 bg-muted/50 px-2 py-2 text-right font-semibold">
              Year
            </th>
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
                <td className="px-2 py-2 font-semibold" colSpan={14}>
                  {SECTION_LABEL[section]}
                </td>
              </tr>

              {groupRows(rows).map(({ group, rows: groupedRows }) => (
                <Fragment key={`${section}-${group}`}>
                  {group !== "" && (
                    <tr>
                      <td
                        className="px-2 py-1.5 text-xs uppercase tracking-wide text-muted-foreground"
                        colSpan={14}>
                        {group}
                      </td>
                    </tr>
                  )}
                  {groupedRows.map((row) => (
                    <tr key={row.categoryId} className="border-t">
                      <td className="sticky left-0 z-10 bg-background px-2 py-1.5">
                        {row.name}
                      </td>
                      {row.months.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                          {money(v)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                        {money(row.total)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}

              {total && (
                <tr className="border-t-2 font-semibold">
                  <td className="sticky left-0 z-10 bg-background px-2 py-2">
                    Total {SECTION_LABEL[section]}
                  </td>
                  {total.months.map((v, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {money(v)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">
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
