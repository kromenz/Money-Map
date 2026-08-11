"use client";

import { formatEur } from "@/lib/format";
import type { MonthDetail } from "@/lib/budget-metrics";

// Uma entrada por posicao da rampa, nao por grupo: os nomes dos grupos vem do
// ficheiro importado e podem ter espacos, acentos ou "&", e as custom properties
// exigem identificadores CSS validos. Com chaves fixas as cores continuam a
// viver so no globals.css.
//
// Indexadas directamente, sem modulo: o monthDetail garante no maximo seis
// entradas (cinco grupos mais Other), e ciclar a rampa daria ao setimo a cor do
// primeiro.
const SLOTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/**
 * Composicao da despesa do mes por grupo, em barra horizontal empilhada.
 *
 * Nao e um anel de proposito: a rampa separa vizinhos pela luminosidade, e num
 * anel o ultimo encosta ao primeiro. Com um numero impar de fatias a
 * alternancia nao fecha e os dois extremos ficam indistinguiveis. Numa barra a
 * adjacencia e linear e o problema nao existe.
 */
export function GroupComposition({
  byGroup,
}: {
  byGroup: MonthDetail["byGroup"];
}) {
  // Reembolsos podem deixar um grupo com total liquido negativo (ver
  // budget-metrics.ts). Isso e correcto para os totais, mas um segmento de
  // comprimento negativo nao existe. Filtramos aqui, so para o desenho -- o
  // CategoryDeltas ao lado mostra os negativos honestamente.
  const positive = byGroup.filter((g) => g.amount > 0);
  const total = positive.reduce((s, g) => s + g.amount, 0);

  if (total === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No expenses this month
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 2px de folga entre segmentos: e parte do reforco que a paleta do tema
          escuro exige, nao decoracao. */}
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
        {positive.map((g, i) => (
          <div
            key={i}
            title={`${g.group}: ${formatEur(g.amount)}`}
            style={{
              width: `${(g.amount / total) * 100}%`,
              background: SLOTS[i],
            }}
          />
        ))}
      </div>

      {/* Legenda sempre presente: a identidade nunca pode depender so da cor. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {positive.map((g, i) => (
          // Indice na chave, nao o nome: um grupo importado chamado "Other"
          // colidia com o rotulo sintetico do tecto de cinco grupos.
          <li key={i} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: SLOTS[i] }}
            />
            <span className="text-muted-foreground">{g.group}</span>
            <span className="tabular-nums">{formatEur(g.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
