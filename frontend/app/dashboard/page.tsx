"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { BudgetGrid } from "../../src/components/BudgetGrid";
import { ImportWorkbook } from "../../src/components/ImportWorkbook";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { YearRail } from "../../src/components/dashboard/YearRail";
import { MonthPanel } from "../../src/components/dashboard/MonthPanel";
import { DashboardSkeleton } from "../../src/components/dashboard/DashboardSkeleton";
import { fetchGrid } from "../../src/services/budget.service";
import { yearMetrics, monthDetail } from "../../src/lib/budget-metrics";
import { MONTH_LABELS } from "../../src/lib/format";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth("/");
  const [year, setYear] = useState(new Date().getFullYear());
  // null significa "usa o predefinido" -- o ultimo mes com movimento. Guardar
  // um indice fixo apontaria para um mes vazio depois de trocar de ano.
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["budget-grid", year],
    queryFn: () => fetchGrid(year),
    enabled: Boolean(user),
  });

  const metrics = useMemo(() => (data ? yearMetrics(data) : null), [data]);
  const activeMonth = selectedMonth ?? metrics?.lastActiveMonth ?? null;
  const detail = useMemo(
    () => (data && activeMonth !== null ? monthDetail(data, activeMonth) : null),
    [data, activeMonth]
  );

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-[1400px] space-y-8 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Budget</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="year" className="text-sm text-muted-foreground">
            Year
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setSelectedMonth(null);
            }}
            className="w-24 rounded-md border px-2 py-1 text-sm"
          />
          <ThemeToggle />
        </div>
      </header>

      <ImportWorkbook year={year} />

      {isLoading && <DashboardSkeleton />}

      {isError && (
        <p className="text-destructive">
          Could not load the dashboard: {(error as Error).message}
        </p>
      )}

      {!isLoading && !isError && activeMonth === null && (
        <div className="rounded-lg border p-8 text-center">
          <p className="font-medium">No data for {year}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import an .xlsx workbook above to get started.
          </p>
        </div>
      )}

      {metrics && detail && activeMonth !== null && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <YearRail
              year={year}
              metrics={metrics}
              selectedMonth={activeMonth}
              onSelectMonth={setSelectedMonth}
            />
          </div>
          <div className="lg:col-span-2">
            <MonthPanel detail={detail} monthLabel={MONTH_LABELS[detail.month]} />
          </div>
        </div>
      )}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Full table
        </summary>
        <div className="mt-4">
          <BudgetGrid year={year} />
        </div>
      </details>
    </main>
  );
}
