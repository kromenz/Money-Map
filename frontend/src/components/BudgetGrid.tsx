"use client";

import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGrid } from "../services/budget.service";
import { Skeleton } from "@/components/ui/skeleton";
import { MONTH_LABELS, formatAmount } from "@/lib/format";
import { groupRows } from "@/lib/group-rows";

const SECTION_LABEL: Record<string, string> = {
  income: "Income",
  savings: "Savings",
  expenses: "Expenses",
};

function money(value: string) {
  const n = Number(value);
  // Um zero em cada celula vazia enchia a grelha de ruido com a mesma forca
  // visual de um valor real. O travessao le-se como ausencia.
  if (n === 0) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className={n < 0 ? "text-destructive" : undefined}>
      {formatAmount(n)}
    </span>
  );
}

/** Fundo da coluna do mes seleccionado, aplicado celula a celula. */
function monthCell(index: number, selectedMonth: number | null) {
  return index === selectedMonth ? "bg-muted/40" : undefined;
}

export function BudgetGrid({
  year,
  selectedMonth = null,
}: {
  year: number;
  /** Indice 0-11 do mes em foco no dashboard, para destacar a coluna. */
  selectedMonth?: number | null;
}) {
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
    <div className="space-y-2">
      {/* A unidade e dita uma vez aqui em vez de catorze vezes por linha. */}
      <p className="text-right text-xs text-muted-foreground">amounts in EUR</p>

      {/*
        O overflow-x fica como rede de seguranca para ecras estreitos, mas com
        px-2 as 14 colunas ja cabem sem scroll na largura da pagina.

        A max-h nao e cosmetica: overflow-x-auto faz o browser calcular
        overflow-y: auto tambem, logo esta div e um scroll container. Sem altura
        limitada nunca ha scroll vertical dentro dela e o sticky do cabecalho
        fica inerte -- colava-se ao topo da div, que desaparece com a pagina.
      */}
      <div className="no-scrollbar max-h-[70vh] overflow-auto rounded-lg border">
        {/*
          table-fixed: sem ele a largura de cada mes depende do maior numero que
          calha nela, e as colunas dancam ao mudar de ano. Com larguras fixas os
          meses ficam todos iguais e os valores alinham na vertical.
        */}
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-56" />
            {MONTH_LABELS.map((m) => (
              <col key={m} />
            ))}
            <col className="w-32" />
          </colgroup>

          <thead>
            {/*
              Cabecalho colado ao topo: com dezenas de categorias perde-se de vista
              que coluna e que mes. O canto acumula sticky no topo e a esquerda, por
              isso precisa de z maior que as duas faixas que atravessa.
            */}
            <tr className="bg-muted/50">
              <th className="sticky left-0 top-0 z-30 bg-muted/50 px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Category
              </th>
              {MONTH_LABELS.map((m, i) => (
                <th
                  key={m}
                  className={`sticky top-0 z-20 bg-muted/50 px-2 py-2 text-right text-xs font-medium uppercase tracking-wide ${
                    i === selectedMonth
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}>
                  {m}
                </th>
              ))}
              {/* A coluna do ano e a que mais se le: ganha um limite proprio. */}
              <th className="sticky top-0 z-20 border-l bg-muted/50 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide">
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
                  <td
                    className="sticky left-0 z-10 bg-primary/5 px-2 py-2 font-semibold"
                    colSpan={14}>
                    {SECTION_LABEL[section]}
                  </td>
                </tr>

                {groupRows(rows).map(({ group, rows: groupedRows }) => (
                  <Fragment key={`${section}-${group}`}>
                    {group !== "" && (
                      <tr>
                        <td
                          className="sticky left-0 z-10 bg-background px-2 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          colSpan={14}>
                          {group}
                        </td>
                      </tr>
                    )}
                    {groupedRows.map((row) => (
                      // O realce vive no <tr>, mas a primeira celula e sticky e
                      // tem fundo proprio para tapar o que passa por baixo --
                      // sem o group-hover ela ficava um buraco branco na linha.
                      <tr
                        key={row.categoryId}
                        className="group border-t hover:bg-muted/40">
                        <td
                          className={`sticky left-0 z-10 bg-background px-2 py-1.5 group-hover:bg-muted/40 ${
                            group !== "" ? "pl-6" : ""
                          }`}>
                          {row.name}
                        </td>
                        {row.months.map((v, i) => (
                          <td
                            key={i}
                            className={`px-2 py-1.5 text-right tabular-nums ${
                              monthCell(i, selectedMonth) ?? ""
                            }`}>
                            {money(v)}
                          </td>
                        ))}
                        <td className="border-l px-2 py-1.5 text-right font-medium tabular-nums">
                          {money(row.total)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}

                {total && (
                  <tr className="group border-t-2 font-semibold hover:bg-muted/40">
                    <td className="sticky left-0 z-10 bg-background px-2 py-2 group-hover:bg-muted/40">
                      Total {SECTION_LABEL[section]}
                    </td>
                    {total.months.map((v, i) => (
                      <td
                        key={i}
                        className={`px-2 py-2 text-right tabular-nums ${
                          monthCell(i, selectedMonth) ?? ""
                        }`}>
                        {money(v)}
                      </td>
                    ))}
                    <td className="border-l px-2 py-2 text-right tabular-nums">
                      {money(total.total)}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </div>
  );
}
