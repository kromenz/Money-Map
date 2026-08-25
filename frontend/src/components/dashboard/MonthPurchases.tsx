"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { formatEur } from "@/lib/format";
import { fetchMonthParcels } from "@/services/parcels.service";
import type { CategoryParcels } from "@/types/parcels";

/**
 * O que foi comprado no mes em foco, categoria a categoria.
 *
 * As celulas da folha ja eram somas de compras (`=42.88+11.39`); o que faltava
 * era mostra-las desmontadas. As parcelas sem etiqueta -- tudo o que ja estava
 * escrito antes de as etiquetas existirem -- aparecem na mesma, porque dizem
 * quantas compras houve e de que valor mesmo sem dizer o que foram.
 *
 * Fechado por omissao: o painel do mes ja e denso, e abrir tudo de uma vez
 * empurrava a grelha para fora do ecra.
 */
function CategoryRow({ category }: { category: CategoryParcels }) {
  const [open, setOpen] = useState(false);
  const label = category.group === "" ? category.name : `${category.group} · ${category.name}`;

  return (
    <li className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-foreground">
        <ChevronRightIcon
          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{formatEur(Number(category.total))}</span>
        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">
          {category.parcels.length === 1
            ? "1 item"
            : `${category.parcels.length} items`}
        </span>
      </button>

      {open && (
        <ul className="mb-2 ml-5 border-l pl-4">
          {category.parcels.map((p) => (
            <li key={p.seq} className="flex items-baseline gap-3 py-1 text-sm">
              <span className="w-20 shrink-0 text-right tabular-nums">
                {formatEur(Number(p.amount))}
              </span>
              {/* O travessao nao e falta de dados: e uma parcela que a folha ja
                  tinha antes de haver etiquetas, e continua a ser uma compra
                  verdadeira com valor verdadeiro. */}
              <span
                className={
                  p.note === null ? "text-muted-foreground" : "text-foreground"
                }>
                {p.note ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function MonthPurchases({
  year,
  month,
  monthLabel,
}: {
  year: number;
  /** 1 = Janeiro. */
  month: number;
  monthLabel: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["budget-parcels", year, month],
    queryFn: () => fetchMonthParcels(year, month),
  });

  if (isPending) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          What was bought
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Um erro aqui nao pode derrubar o painel do mes: isto e detalhe por cima do
  // que a grelha ja diz, e a grelha continua correcta sem ele.
  if (isError || !data || data.categories.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
          What was bought
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          {isError
            ? "The itemised list could not be loaded."
            : `Nothing itemised for ${monthLabel} yet. Amounts added from now on carry a name; older cells only show a breakdown when the sheet stores them as a sum.`}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        What was bought
      </h3>
      <ul>
        {data.categories.map((c) => (
          <CategoryRow key={c.categoryId} category={c} />
        ))}
      </ul>
    </div>
  );
}
