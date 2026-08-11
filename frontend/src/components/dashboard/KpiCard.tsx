"use client";

export function KpiCard({
  label,
  value,
  hint,
  delta,
  higherIsBetter = true,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Variacao relativa face a media. null quando a media e zero. */
  delta?: number | null;
  /** Se subir e bom. Falso na despesa, onde subir e mau. */
  higherIsBetter?: boolean;
}) {
  // Um desvio de menos de 0.5% e ruido de arredondamento, nao noticia.
  const show = delta !== undefined && delta !== null && Math.abs(delta) >= 0.005;
  const up = (delta ?? 0) > 0;
  const bad = show && up !== higherIsBetter;

  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {show && (
        // A seta carrega a direccao; a cor marca so o caso mau. Nao ha verde de
        // "bom": colidia com a serie da receita, e este painel existe para
        // assinalar problemas, nao para dar os parabens.
        <div
          className={`text-xs tabular-nums ${
            bad ? "text-destructive" : "text-muted-foreground"
          }`}>
          {up ? "▲" : "▼"} {Math.abs(Math.round((delta as number) * 100))}% vs
          average
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
