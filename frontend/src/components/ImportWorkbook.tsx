"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { importWorkbook } from "../services/budget.service";
import type { ImportResult } from "../types/budget";
import { Button } from "@/components/ui/button";

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
          `Importadas ${data.transactionsWritten} celulas. Os totais batem com a folha.`
        );
      } else {
        const falhados = data.checksums.filter((c) => !c.ok).length;
        toast.error(
          `Importado, mas ${falhados} total(is) nao batem com a folha. Ver abaixo.`
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
            if (!file) return toast.error("Escolhe um ficheiro .xlsx");
            mutation.mutate(file);
          }}>
          {mutation.isPending ? "A importar..." : `Importar ${year}`}
        </Button>
      </div>

      {result && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Folha</th>
                <th className="px-3 py-2 text-right font-medium">Importado</th>
                <th className="px-3 py-2 text-center font-medium">Bate</th>
              </tr>
            </thead>
            <tbody>
              {result.checksums.map((c) => (
                <tr key={c.scope} className="border-t">
                  <td className="px-3 py-1.5">{c.scope}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{c.sheet}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {c.imported}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-center ${
                      c.ok ? "text-primary" : "text-destructive"
                    }`}>
                    {c.ok ? "sim" : "NAO"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
