"use client";

import { formatEur } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import { deltaVsAverage } from "@/lib/budget-metrics";
import type { CategoryDelta } from "@/lib/category-deltas";

const TOP_N = 6;

/**
 * O que saiu do costume neste mes. Ordenado pelo desvio absoluto, porque gastar
 * muito menos do que o habitual e tao digno de nota como gastar muito mais.
 *
 * A barra e divergente a partir do centro, a mesma gramatica do grafico do ano:
 * dois vocabularios visuais na mesma pagina obrigavam a aprender ambos.
 */
export function CategoryDeltas({ deltas }: { deltas: CategoryDelta[] }) {
  const hidden = useHiddenValues();

  // Um so mes activo no ano faz media == valor em todas as categorias, logo
  // delta == 0 em todas -- sem este filtro a lista mostrava seis linhas de
  // "(-EUR0.00)" com barras de largura zero. O limiar 0.005 e o mesmo que o
  // KpiCard usa para a mesma decisao (menos de isso e ruido de arredondamento,
  // nao noticia); mantidos iguais de proposito.
  const shown = deltas.filter((d) => Math.abs(d.delta) >= 0.005).slice(0, TOP_N);

  if (shown.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Nothing unusual this month
      </div>
    );
  }

  // A escala e comum a todas as linhas: barras com escalas diferentes por linha
  // sao comparaveis a olho e nao o sao de facto.
  const widest = Math.max(...shown.map((d) => Math.abs(d.delta)));

  return (
    <ul className="space-y-2">
      {shown.map((d, i) => {
        // Racio directo do meio-contentor: sem isto multiplicava por 50 aqui e
        // por 2 no width abaixo, e as duas se cancelavam sem dizer nada.
        const pct = widest === 0 ? 0 : Math.abs(d.delta) / widest;
        const over = d.delta > 0;
        // Com os valores tapados o desvio passa a relativo: "(+18%)" em vez de
        // um segundo tapume ao lado do primeiro, que nao dizia nada. E a mesma
        // conta e o mesmo arredondamento do "vs average" dos KpiCard por cima,
        // para as duas leituras nao divergirem. O sinal ja vem escrito a parte.
        // Media zero nao tem variacao percentual -- ai fica a mascara.
        const rel = deltaVsAverage(d.amount, d.average);
        return (
          // Indice na chave: os nomes vem do ficheiro importado e podem
          // repetir-se entre grupos.
          <li key={`${d.name}-${i}`} className="grid grid-cols-[1fr_auto] gap-x-3 text-xs">
            <span className="truncate" title={`${d.group} · ${d.name}`}>
              {d.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatEur(d.amount, hidden)}{" "}
              <span className={over ? "text-destructive" : ""}>
                ({over ? "+" : "−"}
                {hidden && rel !== null
                  ? `${Math.abs(Math.round(rel * 100))}%`
                  : formatEur(Math.abs(d.delta), hidden)}
                )
              </span>
            </span>

            <div className="col-span-2 flex h-2 items-center">
              <div className="flex h-full w-1/2 justify-end">
                {!over && (
                  <div
                    className="h-full rounded-l-[3px]"
                    style={{ width: `${pct * 100}%`, background: "var(--chart-savings)" }}
                  />
                )}
              </div>
              <div className="h-full w-px bg-border" />
              <div className="flex h-full w-1/2">
                {over && (
                  <div
                    className="h-full rounded-r-[3px]"
                    style={{ width: `${pct * 100}%`, background: "var(--chart-expenses)" }}
                  />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
