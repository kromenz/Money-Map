"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchYears,
  importWorkbook,
  previewWorkbook,
} from "../services/budget.service";
import type { ImportResult, PreviewResult } from "../types/budget";
import { Button } from "@/components/ui/button";
import { MONTH_LABELS } from "@/lib/format";
import { decideImport } from "@/lib/import-decision";

/** O ficheiro escolhido e o diff que o servidor devolveu para ele. */
type Pending = { file: File; diff: PreviewResult };

/**
 * O WorkbookFormatError do backend devolve uma mensagem legivel em
 * { error: "..." } no corpo da resposta. err.message de um erro do axios e
 * so "Request failed with status code 400" -- inutil para o utilizador.
 */
function extractErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response
    ?.data;
  if (data && typeof data.error === "string") return data.error;
  return err instanceof Error ? err.message : String(err);
}

export function ImportWorkbook({
  year,
  compact = false,
}: {
  year: number;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const queryClient = useQueryClient();

  const { data: years } = useQuery({
    queryKey: ["budget-years"],
    queryFn: fetchYears,
  });

  // Enquanto a lista de anos nao chega, assumir que o ano TEM dados. Assumir o
  // contrario abria uma janela em que largar um ficheiro substituia um ano
  // cheio sem confirmacao nenhuma. Na duvida, mostra-se o diff.
  const yearHasData =
    years === undefined || years.some((y) => y.year === year);

  // O ano vai no argumento e nao vem do closure: o ficheiro largado pode ser
  // de um ano diferente daquele que esta a ser visto.
  const preview = useMutation({
    mutationFn: ({ file, year }: { file: File; year: number }) =>
      previewWorkbook(file, year),
    onSuccess: (diff, { file }) => setPending({ file, diff }),
    onError: (err: Error) => toast.error(extractErrorMessage(err)),
  });

  const importing = useMutation({
    mutationFn: ({ file, year }: { file: File; year: number }) =>
      importWorkbook(file, year),
    onSuccess: (data) => {
      setResult(data);
      setPending(null);
      setShowDetail(false);
      // data.year e o ano onde o servidor escreveu, nao o que estava a ser visto.
      queryClient.invalidateQueries({ queryKey: ["budget-grid", data.year] });
      // A lista de anos muda quando um ano passa a ter (ou deixa de ter) dados.
      queryClient.invalidateQueries({ queryKey: ["budget-years"] });

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
    onError: (err: Error) => toast.error(extractErrorMessage(err)),
  });

  const busy = preview.isPending || importing.isPending;

  function handleFile(file: File | undefined) {
    if (!file) return;

    const decision = decideImport({
      fileName: file.name,
      viewedYear: year,
      yearsWithData: years?.map((y) => y.year),
      busy,
    });

    if (decision.action === "reject") {
      toast.error(decision.reason);
      return;
    }

    setResult(null);
    if (decision.action === "preview") {
      preview.mutate({ file, year: decision.year });
    } else {
      importing.mutate({ file, year: decision.year });
    }
  }

  // Estado de confirmacao: a zona transforma-se na pergunta, sem modal.
  if (pending) {
    const { summary } = pending.diff;
    return (
      <div className="space-y-3 rounded-lg border p-4 text-sm">
        <p className="font-medium">
          {pending.file.name} vs what you already have in {pending.diff.year}:
        </p>
        <ul className="text-muted-foreground">
          <li>{summary.changed} values change</li>
          <li>{summary.added} new values</li>
          <li>{summary.removed} values disappear</li>
          <li>{summary.equal} unchanged</li>
        </ul>

        {showDetail && pending.diff.changes.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-2 py-1 font-medium">Scope</th>
                <th className="px-2 py-1 font-medium">Category</th>
                <th className="px-2 py-1 font-medium">Month</th>
                <th className="px-2 py-1 text-right font-medium">Before</th>
                <th className="px-2 py-1 text-right font-medium">After</th>
              </tr>
            </thead>
            <tbody>
              {pending.diff.changes.map((c) => (
                <tr key={`${c.scope}-${c.name}-${c.month}`} className="border-t">
                  <td className="px-2 py-1">{c.scope}</td>
                  <td className="px-2 py-1">{c.name}</td>
                  <td className="px-2 py-1">{MONTH_LABELS[c.month - 1]}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {c.from ?? "—"}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {c.to ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center gap-2">
          {pending.diff.changes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetail((s) => !s)}>
              {showDetail ? "Hide detail" : "Show detail"}
            </Button>
          )}
          <Button
            disabled={importing.isPending}
            onClick={() =>
              importing.mutate({
                file: pending.file,
                year: pending.diff.year,
              })
            }>
            {importing.isPending ? "Importing..." : "Import"}
          </Button>
          <Button
            variant="ghost"
            disabled={importing.isPending}
            onClick={() => {
              setPending(null);
              setShowDetail(false);
            }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // O rotulo diz o que este ano tem, nao o tamanho da zona -- compact so
  // controla o espaco ocupado. Um ano recem-criado via YearPills e "compact"
  // (ha outras categorias) mas ainda esta vazio, e tem de dizer isso.
  const label = busy
    ? "Reading the file..."
    : yearHasData
      ? `Replace ${year}`
      : `No data for ${year}`;

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Import sheet for ${year}`}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`cursor-pointer rounded-lg border border-dashed text-center transition-colors ${
          compact ? "px-4 py-3 text-sm" : "px-6 py-12"
        } ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"} ${
          busy ? "cursor-wait opacity-60" : ""
        }`}>
        <p className={compact ? "font-medium" : "text-lg font-medium"}>{label}</p>
        {!compact && !busy && (
          <p className="mt-1 text-sm text-muted-foreground">
            Drop the .xlsx sheet here, or click to choose
          </p>
        )}
      </div>

      {/* Escondido, mas e ele que da o clique-para-escolher e o teclado. */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          // Permite escolher o mesmo ficheiro outra vez a seguir.
          e.target.value = "";
        }}
      />

      {result && (
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
                  ({result.structure.comparisonsSkipped} with no value in the
                  sheet, not compared)
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
