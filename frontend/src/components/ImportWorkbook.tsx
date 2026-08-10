"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { importWorkbook } from "../services/budget.service";
import type { ImportResult } from "../types/budget";
import { Button } from "@/components/ui/button";
import { MONTH_LABELS } from "@/lib/format";

export function ImportWorkbook({ year }: { year: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (file: File) => importWorkbook(file, year),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["budget-grid", year] });

      if (data.allMatch) {
        toast.success(
          `Imported ${data.structure.categories} categories, ${data.transactionsWritten} values.`
        );
      } else {
        const failed = data.comparisons.filter((c) => !c.ok).length;
        toast.error(
          `Nothing was saved: ${failed} monthly total(s) do not match the sheet.`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
        />
        <Button
          disabled={mutation.isPending}
          onClick={() => {
            const file = inputRef.current?.files?.[0];
            if (!file) return toast.error("Choose an .xlsx file");
            mutation.mutate(file);
          }}>
          {mutation.isPending ? "Importing..." : `Import ${year}`}
        </Button>
      </div>

      {result && (
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <p>
            {result.structure.categories} categorias em{" "}
            {result.structure.groups.length} grupos,{" "}
            {result.transactionsWritten} valores.{" "}
            {result.structure.comparisonsMade} verificacoes
            {result.structure.comparisonsSkipped > 0 && (
              <span className="text-muted-foreground">
                {" "}
                ({result.structure.comparisonsSkipped} sem valor na folha, por
                comparar)
              </span>
            )}
            .
          </p>

          {!result.allMatch && (
            <div>
              <p className="font-medium text-destructive">
                Nada foi gravado. Estes totais nao batem com a folha:
              </p>
              <table className="mt-2 w-full">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-2 py-1 font-medium">Escopo</th>
                    <th className="px-2 py-1 font-medium">Mes</th>
                    <th className="px-2 py-1 text-right font-medium">Folha</th>
                    <th className="px-2 py-1 text-right font-medium">Importado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.comparisons
                    .filter((c) => !c.ok)
                    .map((c) => (
                      <tr key={`${c.scope}-${c.month}`} className="border-t">
                        <td className="px-2 py-1">{c.scope}</td>
                        <td className="px-2 py-1">{MONTH_LABELS[c.month - 1]}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{c.sheet}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {c.imported}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
