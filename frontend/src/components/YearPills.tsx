"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchYears } from "../services/budget.service";
import { yearNav } from "@/lib/year-nav";
import { Button } from "@/components/ui/button";

/**
 * So navegacao. Adicionar um ano nao se faz aqui: faz-se largando a folha na
 * zona de import, que le o ano do nome do ficheiro.
 */
export function YearPills({
  year,
  onSelect,
}: {
  year: number;
  onSelect: (year: number) => void;
}) {
  const { data } = useQuery({
    queryKey: ["budget-years"],
    queryFn: fetchYears,
  });

  const nav = yearNav(
    (data ?? []).map((y) => y.year),
    year
  );

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Previous year"
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

      <Button
        variant="ghost"
        size="sm"
        aria-label="Next year"
        disabled={!nav.canGoNext}
        onClick={() => nav.next !== null && onSelect(nav.next)}>
        ›
      </Button>
    </div>
  );
}
