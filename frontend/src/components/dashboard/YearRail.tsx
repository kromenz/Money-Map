"use client";

import { KpiCard } from "./KpiCard";
import { MonthSelectorChart } from "./MonthSelectorChart";
import { formatEur, formatPercent } from "@/lib/format";
import type { YearMetrics } from "@/lib/budget-metrics";

export function YearRail({
  year,
  metrics,
  selectedMonth,
  onSelectMonth,
}: {
  year: number;
  metrics: YearMetrics;
  selectedMonth: number;
  onSelectMonth: (month: number) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{year}</h2>

      <div className="space-y-2">
        <KpiCard label="Income" value={formatEur(metrics.income)} />
        <KpiCard label="Expenses" value={formatEur(metrics.expenses)} />
        <KpiCard label="Savings" value={formatEur(metrics.savings)} />
        <KpiCard label="Savings rate" value={formatPercent(metrics.savingsRate)} />
        <KpiCard
          label="Unallocated"
          value={formatEur(metrics.unallocated)}
          hint="Income minus expenses and savings"
        />
      </div>

      <div>
        <h3 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
          Months
        </h3>
        <MonthSelectorChart
          months={metrics.months}
          selectedMonth={selectedMonth}
          onSelectMonth={onSelectMonth}
        />
      </div>
    </section>
  );
}
