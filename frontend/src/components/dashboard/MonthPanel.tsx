"use client";

import { KpiCard } from "./KpiCard";
import { ExpenseDonut } from "./ExpenseDonut";
import { TopCategories } from "./TopCategories";
import { formatEur, formatPercent } from "@/lib/format";
import type { MonthDetail } from "@/lib/budget-metrics";

export function MonthPanel({
  detail,
  monthLabel,
}: {
  detail: MonthDetail;
  monthLabel: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        {monthLabel} in detail
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <KpiCard label="Income" value={formatEur(detail.income)} />
        <KpiCard label="Expenses" value={formatEur(detail.expenses)} />
        <KpiCard label="Savings" value={formatEur(detail.savings)} />
        <KpiCard label="Savings rate" value={formatPercent(detail.savingsRate)} />
        <KpiCard label="Unallocated" value={formatEur(detail.unallocated)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            By group
          </h3>
          <ExpenseDonut byGroup={detail.byGroup} />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Top categories
          </h3>
          <TopCategories topCategories={detail.topCategories} />
        </div>
      </div>
    </section>
  );
}
