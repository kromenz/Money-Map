"use client";

import { useState } from "react";
import useRequireAuth from "../../src/hooks/useRequireAuth";
import { BudgetGrid } from "../../src/components/BudgetGrid";
import { ImportWorkbook } from "../../src/components/ImportWorkbook";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth("/");
  const [year, setYear] = useState(new Date().getFullYear());

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-[1400px] space-y-8 p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Orcamento</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="year" className="text-sm text-muted-foreground">
            Ano
          </label>
          <input
            id="year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded-md border px-2 py-1 text-sm"
          />
        </div>
      </header>

      <ImportWorkbook year={year} />
      <BudgetGrid year={year} />
    </main>
  );
}
