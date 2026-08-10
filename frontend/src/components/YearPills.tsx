"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchYears } from "../services/budget.service";
import { yearNav } from "@/lib/year-nav";
import { Button } from "@/components/ui/button";

export function YearPills({
  year,
  onSelect,
}: {
  year: number;
  onSelect: (year: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(String(year));

  const { data } = useQuery({
    queryKey: ["budget-years"],
    queryFn: fetchYears,
  });

  const nav = yearNav((data ?? []).map((y) => y.year), year);

  function commitDraft() {
    const parsed = Number(draft);
    // Os mesmos limites do importQuerySchema do backend.
    if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) {
      onSelect(parsed);
    }
    setAdding(false);
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Ano anterior"
        disabled={!nav.canGoPrev}
        onClick={() => nav.prev !== null && onSelect(nav.prev)}>
        ‹
      </Button>

      {nav.years.map((y) => (
        <Button
          key={y}
          variant={y === year ? "default" : "ghost"}
          size="sm"
          aria-current={y === year ? "true" : undefined}
          onClick={() => onSelect(y)}>
          {y}
        </Button>
      ))}

      {adding ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDraft();
            if (e.key === "Escape") setAdding(false);
          }}
          className="w-20 rounded-md border px-2 py-1 text-sm"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Outro ano"
          onClick={() => {
            setDraft(String(year));
            setAdding(true);
          }}>
          +
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-label="Ano seguinte"
        disabled={!nav.canGoNext}
        onClick={() => nav.next !== null && onSelect(nav.next)}>
        ›
      </Button>
    </div>
  );
}
