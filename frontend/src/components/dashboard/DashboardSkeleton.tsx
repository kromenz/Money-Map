"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * A mesma forma do caminho feliz em renderContent() (app/dashboard/page.tsx):
 * zona de largar quadrada ao lado do resumo do ano, grafico com a largura
 * toda por baixo, e a seccao do mes com a linha de KPIs e o par de cartoes.
 * Sem isto o esqueleto nao se parece com o que carrega a seguir e o ecra
 * reflui quando os dados chegam.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-6">
        <Skeleton className="aspect-square w-28" />
        <Skeleton className="h-14 min-w-0 flex-1" />
      </div>

      <Skeleton className="h-64 w-full" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
