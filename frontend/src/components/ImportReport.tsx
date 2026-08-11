import type { ImportResult } from "../types/budget";
import { MONTH_LABELS } from "@/lib/format";

/**
 * O relatorio do ultimo import. Vive na pagina e nao dentro da zona de largar:
 * trocar de ano a seguir a importar desmonta a zona, e o relatorio ia com ela.
 */
export function ImportReport({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      {result.allMatch && (
        <p>
          {result.structure.categories} categories in{" "}
          {result.structure.groups.length} groups,{" "}
          {result.transactionsWritten} values.{" "}
          {result.structure.comparisonsMade} checks
          {result.structure.comparisonsSkipped > 0 && (
            <span className="text-muted-foreground">
              {" "}
              ({result.structure.comparisonsSkipped} with no value in the sheet,
              not compared)
            </span>
          )}
          .
        </p>
      )}

      {!result.allMatch && (
        <div>
          <p className="font-medium text-destructive">
            Nothing was saved. These totals do not match the sheet:
          </p>
          <table className="mt-2 w-full">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-2 py-1 font-medium">Scope</th>
                <th className="px-2 py-1 font-medium">Month</th>
                <th className="px-2 py-1 text-right font-medium">Sheet</th>
                <th className="px-2 py-1 text-right font-medium">Imported</th>
              </tr>
            </thead>
            <tbody>
              {result.comparisons
                .filter((c) => !c.ok)
                .map((c) => (
                  <tr key={`${c.scope}-${c.month}`} className="border-t">
                    <td className="px-2 py-1">{c.scope}</td>
                    <td className="px-2 py-1">{MONTH_LABELS[c.month - 1]}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {c.sheet}
                    </td>
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
  );
}
