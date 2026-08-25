"use client";

import { KpiCard } from "./KpiCard";
import { GroupComposition } from "./GroupComposition";
import { CategoryDeltas } from "./CategoryDeltas";
import { MonthPurchases } from "./MonthPurchases";
import { InvestmentsOverview } from "./InvestmentsOverview";
import { formatEur, formatPercent } from "@/lib/format";
import { deltaVsAverage } from "@/lib/budget-metrics";
import type { MonthDetail, MonthAverages } from "@/lib/budget-metrics";
import type { CategoryDelta } from "@/lib/category-deltas";

export function MonthPanel({
  detail,
  monthLabel,
  averages,
  deltas,
  year,
}: {
  detail: MonthDetail;
  monthLabel: string;
  averages: MonthAverages;
  deltas: CategoryDelta[];
  year: number;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {monthLabel} in detail
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <KpiCard
          label="Income"
          value={formatEur(detail.income)}
          delta={deltaVsAverage(detail.income, averages.income)}
        />
        {/* Na despesa, subir e mau. E o unico KPI com o sentido invertido. */}
        <KpiCard
          label="Expenses"
          value={formatEur(detail.expenses)}
          delta={deltaVsAverage(detail.expenses, averages.expenses)}
          higherIsBetter={false}
        />
        <KpiCard
          label="Savings"
          value={formatEur(detail.savings)}
          delta={deltaVsAverage(detail.savings, averages.savings)}
        />
        <KpiCard label="Savings rate" value={formatPercent(detail.savingsRate)} />
        <KpiCard
          label="Left over"
          value={formatEur(detail.unallocated)}
          delta={deltaVsAverage(detail.unallocated, averages.unallocated)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Where it went
          </h3>
          <GroupComposition
            byGroup={detail.byGroup}
            emptyMessage="No expenses this month"
          />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
            Unusual this month
          </h3>
          <CategoryDeltas deltas={deltas} />
        </div>
      </div>

      {/* Por baixo da linha "Where it went" / "Unusual this month", onde ele o
          quis. Nota para quem vier a seguir: os numeros deste cartao sao da
          carteira inteira e nao do mes em foco -- e o unico bloco deste painel
          que nao muda quando se troca de mes. */}
      <InvestmentsOverview />

      {/* Largura toda e nao ao lado dos outros dois: as etiquetas sao texto
          livre do utilizador e nao cabem numa meia coluna. */}
      <MonthPurchases
        year={year}
        month={detail.month + 1}
        monthLabel={monthLabel}
      />
    </section>
  );
}
