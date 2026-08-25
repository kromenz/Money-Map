"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCashFlows } from "@/services/t212.service";
import { formatEur } from "@/lib/format";

const PAGE = 50;

const LABELS: Record<string, string> = {
  DEPOSIT: "Deposito",
  WITHDRAW: "Levantamento",
  FEE: "Taxa",
  TRANSFER: "Transferencia",
  INTEREST_ON_FREE_CASH: "Juros de caixa",
  LENDING_INTEREST: "Juros de emprestimo",
};

/**
 * A marca do corte esta aqui e nao so no aviso do topo: e nesta tabela que se
 * procura um deposito especifico quando a grelha do orcamento nao bate. O
 * "atravessa" em si vem de crossesBudget no servidor -- a mesma regra que o
 * bridgeRows usa para escrever a folha, nao uma copia local.
 */
export function CashFlowTable() {
  const [offset, setOffset] = useState(0);

  const { data } = useQuery({
    queryKey: ["t212-cashflows", offset],
    queryFn: () => fetchCashFlows({ limit: PAGE, offset }),
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Caixa</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Data</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-right">Valor</th>
              <th className="px-2 py-2 text-left">No orcamento</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((c) => (
              <tr key={c.externalId} className="border-b last:border-0">
                <td className="px-2 py-2">{c.dateTime.slice(0, 10)}</td>
                <td className="px-2 py-2">{LABELS[c.type] ?? c.type}</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatEur(Number(c.amount))}</td>
                <td className="px-2 py-2 text-xs text-muted-foreground">
                  {c.crossesBudget ? "Sim" : "Nao"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data
            ? data.total === 0
              ? "Sem movimentos"
              : `${offset + 1}–${Math.min(offset + PAGE, data.total)} de ${data.total}`
            : ""}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE))} className="rounded-md border px-2 py-1 disabled:opacity-40">
            Anterior
          </button>
          <button type="button" disabled={!data || offset + PAGE >= data.total} onClick={() => setOffset((o) => o + PAGE)} className="rounded-md border px-2 py-1 disabled:opacity-40">
            Seguinte
          </button>
        </div>
      </div>
    </section>
  );
}
